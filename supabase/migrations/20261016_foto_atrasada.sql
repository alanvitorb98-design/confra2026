-- A photo taken while the camera was open but sent after it closed (no signal at the party, the app reopened
-- the next day) is still accepted. Its id is a UUID v7 made by the phone, whose first 48 bits are the time it
-- was taken. Late sends are taken for 3 days after the party; older ids without a time follow the old rule.
create or replace function public.photo_taken_at(p uuid) returns timestamptz
language sql immutable set search_path = '' as $$
  select case when substr(p::text, 15, 1) = '7'
    then to_timestamp(('x' || lpad(substr(replace(p::text, '-', ''), 1, 12), 16, '0'))::bit(64)::bigint / 1000.0) end
$$;
revoke all on function public.photo_taken_at(uuid) from public, anon, authenticated;

create or replace function public.send_photo(p_id uuid, p_kind text, p_caption text, p_frame text, p_tilt real, p_original text, p_preview text, p_bytes bigint, p_mission uuid default null)
returns void language plpgsql security definer set search_path to '' as $function$
declare g uuid; c public.event_config; n int; t boolean := false; owner uuid; taken timestamptz; opens timestamptz; closes timestamptz;
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
  if p_kind = 'look' then opens := c.look_opens; closes := c.look_closes; else opens := c.party_starts; closes := c.party_ends; end if;
  taken := public.photo_taken_at(p_id);
  -- open now (with 2 hours for retries), or taken while open and sent within 3 days
  if not (now() >= opens and now() < closes + interval '2 hours')
     and not (taken is not null and taken >= opens - interval '5 minutes' and taken < closes + interval '5 minutes'
              and taken <= now() + interval '5 minutes' and now() < closes + interval '3 days') then
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
end $function$;
