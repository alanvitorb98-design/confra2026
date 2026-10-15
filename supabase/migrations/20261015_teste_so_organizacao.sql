-- Organizer tests never change the app for anyone else. There is no global test mode for guests any more:
-- outside the photo hours only organizers can post, and what they post then is a test photo that only
-- organizers see (feed, files, downloads). Guests keep the normal flow at all times.
alter table public.photos add column if not exists test boolean not null default false;

-- everything posted so far was a test (the party has not started)
update public.photos set test = true where not test and created_at < (select least(look_opens, party_starts) from public.event_config);

create or replace function public.send_photo(p_id uuid, p_kind text, p_caption text, p_frame text, p_tilt real, p_original text, p_preview text, p_bytes bigint, p_mission uuid default null::uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare g uuid; c public.event_config; n int; t boolean := false;
begin
  g := public.my_guest();
  if g is null then raise exception 'convidado não encontrado'; end if;
  select * into c from public.event_config;
  if (p_kind = 'look' and not (now() >= c.look_opens and now() < c.look_closes))
     or (p_kind = 'party' and not (now() >= c.party_starts and now() < c.party_ends)) then
    -- outside the hours: an organizer's test, seen only by the organization
    if not public.is_admin() then raise exception '%', case when p_kind = 'look' then 'looks fechados' else 'câmera fechada' end; end if;
    t := true;
  end if;
  if regexp_replace(p_original, '^r2/', '') not like p_kind || '/' || g || '/' || p_id || '%' or p_preview not like p_kind || '/' || g || '/' || p_id || '%' then
    raise exception 'caminho inválido';
  end if;
  if p_mission is not null and not exists (select 1 from public.missions where id = p_mission and active) then
    raise exception 'missão fechada';
  end if;
  select count(*) into n from public.photos where guest_id = g;
  if n >= 300 then raise exception 'limite de fotos'; end if;
  if p_kind = 'look' then
    update public.photos set removed_at = now() where guest_id = g and kind = 'look' and removed_at is null and test = t;
  end if;
  insert into public.photos (id, guest_id, kind, caption, frame, tilt, original_path, preview_path, bytes, mission_id, test)
  values (p_id, g, p_kind, left(coalesce(p_caption, ''), 140), p_frame, greatest(-4, least(4, coalesce(p_tilt, 0))), p_original, p_preview, p_bytes,
    case when p_kind = 'party' then p_mission end, t);
end $$;

alter policy "read photos" on public.photos using ((select public.is_guest()) and (not test or (select public.is_admin())));

alter policy "guests see the photos" on storage.objects using (
  bucket_id = 'fotos' and (select public.is_guest()) and (
    (storage.foldername(name))[2] = (select public.my_guest())::text
    or ((storage.foldername(name))[1] = any (array['party', 'look']) and exists (
      select 1 from public.photos p
      where p.id::text = left(storage.filename(objects.name), 36) and p.removed_at is null and (not p.test or (select public.is_admin()))
    ))
  )
);

-- "Limpar fotos de teste" clears only test photos, never a guest's real one
create or replace function public.admin_clear_photos()
returns integer language plpgsql security definer set search_path to '' as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  update public.photos set removed_at = now() where removed_at is null and test;
  get diagnostics n = row_count;
  update public.reactions r set active = false from public.photos p where p.id = r.photo_id and p.test and r.active;
  return n;
end $$;
