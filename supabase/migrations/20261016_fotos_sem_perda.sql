-- No photo is lost: the phone keeps every photo until the server confirms it and sends it again on its own,
-- so send_photo must take the same photo twice (a retry after an answer that never arrived), a retry that
-- arrives after the camera closed (taken in time, sent late), and a mission that closed meanwhile.
create or replace function public.send_photo(p_id uuid, p_kind text, p_caption text, p_frame text, p_tilt real, p_original text, p_preview text, p_bytes bigint, p_mission uuid default null)
returns void language plpgsql security definer set search_path to '' as $$
declare g uuid; c public.event_config; n int; t boolean := false; owner uuid;
begin
  g := public.my_guest();
  if g is null then raise exception 'convidado não encontrado'; end if;
  -- already here: the earlier try made it, nothing to do
  select guest_id into owner from public.photos where id = p_id;
  if found then
    if owner = g then return; end if;
    raise exception 'foto já existe';
  end if;
  select * into c from public.event_config;
  -- a photo sent again by the phone shortly after the camera closed was taken while it was open
  if (p_kind = 'look' and not (now() >= c.look_opens and now() < c.look_closes + interval '2 hours'))
     or (p_kind = 'party' and not (now() >= c.party_starts and now() < c.party_ends + interval '2 hours')) then
    if not public.is_admin() then raise exception '%', case when p_kind = 'look' then 'looks fechados' else 'câmera fechada' end; end if;
    t := true;
  end if;
  if regexp_replace(p_original, '^r2/', '') not like p_kind || '/' || g || '/' || p_id || '%' or p_preview not like p_kind || '/' || g || '/' || p_id || '%' then
    raise exception 'caminho inválido';
  end if;
  -- the mission closed while the photo was on its way: keep the photo, without the mission
  if p_mission is not null and not exists (select 1 from public.missions where id = p_mission and active) then
    p_mission := null;
  end if;
  select count(*) into n from public.photos where guest_id = g;
  if n >= 300 then raise exception 'limite de fotos'; end if;
  if p_kind = 'look' then
    update public.photos set removed_at = now() where guest_id = g and kind = 'look' and removed_at is null and test = t;
  end if;
  insert into public.photos (id, guest_id, kind, caption, frame, tilt, original_path, preview_path, bytes, mission_id, test)
  values (p_id, g, p_kind, left(coalesce(p_caption, ''), 140), p_frame, greatest(-4, least(4, coalesce(p_tilt, 0))), p_original, p_preview, p_bytes,
    case when p_kind = 'party' then p_mission end, t)
  on conflict (id) do nothing;
end $$;
