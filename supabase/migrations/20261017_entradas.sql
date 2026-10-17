-- Hostile input: a photo's file paths must be exactly the ones its own guest uploads. Before, a path only had
-- to start with the right folder, so something like "party/<me>/<id>/../../<someone else's file>" got in, and
-- the server signs links for the paths it stores.
create or replace function public.send_photo(p_id uuid, p_kind text, p_caption text, p_frame text, p_tilt real,
  p_original text, p_preview text, p_bytes bigint, p_mission uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare g uuid; c public.event_config; n int; t boolean := false; owner uuid; taken timestamptz; opens timestamptz; closes timestamptz;
begin
  g := public.my_guest();
  if g is null then raise exception 'convidado não encontrado'; end if;
  if p_kind is null or p_kind not in ('party', 'look') then raise exception 'tipo inválido'; end if;
  -- already here: the earlier try made it, nothing to do
  select guest_id into owner from public.photos where id = p_id;
  if found then
    if owner = g then return; end if;
    raise exception 'foto já existe';
  end if;
  select * into c from public.event_config;
  if p_kind = 'look' then opens := c.look_opens; closes := c.look_closes; else opens := c.party_starts; closes := c.party_ends; end if;
  taken := public.photo_taken_at(p_id);
  -- open now (with 2 hours for retries), or taken while open and sent within 3 days
  if not (now() >= opens and now() < closes + interval '2 hours')
     and not (taken is not null and taken >= opens - interval '5 minutes' and taken < closes + interval '5 minutes'
              and taken <= now() + interval '5 minutes' and now() < closes + interval '3 days') then
    if not public.is_admin() then raise exception '%', case when p_kind = 'look' then 'looks fechados' else 'câmera fechada' end; end if;
    t := true;
  end if;
  if p_original is null or p_original !~ ('^' || p_kind || '/' || g || '/' || p_id || '\.(jpe?g|png|heic|heif|webp)$')
     or p_preview is distinct from p_kind || '/' || g || '/' || p_id || '-p.jpg' then
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
revoke all on function public.send_photo(uuid, text, text, text, real, text, text, bigint, uuid) from public, anon, authenticated;
grant execute on function public.send_photo(uuid, text, text, text, real, text, text, bigint, uuid) to authenticated;

-- And the table itself refuses any other shape, whoever writes it.
alter table public.photos add constraint photos_paths_check check (
  original_path ~ ('^' || kind || '/' || guest_id || '/' || id || '\.(jpe?g|png|heic|heif|webp)$')
  and preview_path = kind || '/' || guest_id || '/' || id || '-p.jpg'
);
