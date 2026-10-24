-- Switches for the day of the party, in the organizer's panel, with no new version of the app: face recognition
-- (paused: the reader is not started and finds nothing to do; new guests are not asked for a selfie), the missions
-- tab and the ranking tab. All on by default.
alter table public.event_config add column faces_on boolean default true not null;
alter table public.event_config add column missions_on boolean default true not null;
alter table public.event_config add column ranking_on boolean default true not null;

CREATE OR REPLACE FUNCTION public.event_public(p_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.event_config;
begin
  select * into c from public.event_config;
  return jsonb_build_object(
    'app_opens', c.app_opens, 'party_starts', c.party_starts, 'party_ends', c.party_ends,
    'look_opens', c.look_opens, 'look_closes', c.look_closes, 'test_mode', c.test_mode,
    'place', c.place, 'address', c.address, 'maps_url', c.maps_url, 'lat', c.lat, 'lng', c.lng,
    'invite_only', c.invite_only, 'faces_on', c.faces_on, 'missions_on', c.missions_on,
    'ranking_on', c.ranking_on, 'now', now()
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_update_event(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  if coalesce(p->>'maps_url', '') <> '' and p->>'maps_url' !~ '^https://' then
    raise exception 'o link do mapa precisa começar com https://';
  end if;
  update public.event_config set
    app_opens = coalesce((p->>'app_opens')::timestamptz, app_opens),
    party_starts = coalesce((p->>'party_starts')::timestamptz, party_starts),
    party_ends = coalesce((p->>'party_ends')::timestamptz, party_ends),
    look_opens = coalesce((p->>'look_opens')::timestamptz, look_opens),
    look_closes = coalesce((p->>'look_closes')::timestamptz, look_closes),
    place = coalesce(left(p->>'place', 80), place),
    address = coalesce(left(p->>'address', 160), address),
    maps_url = coalesce(left(p->>'maps_url', 300), maps_url),
    lat = case when p ? 'lat' then (p->>'lat')::double precision else lat end,
    lng = case when p ? 'lng' then (p->>'lng')::double precision else lng end,
    test_mode = coalesce((p->>'test_mode')::boolean, test_mode),
    invite_only = coalesce((p->>'invite_only')::boolean, invite_only),
    faces_on = coalesce((p->>'faces_on')::boolean, faces_on),
    missions_on = coalesce((p->>'missions_on')::boolean, missions_on),
    ranking_on = coalesce((p->>'ranking_on')::boolean, ranking_on),
    gen_missions = coalesce((p->>'gen_missions')::boolean, gen_missions),
    -- greatest/least skip nulls, so a missing field must keep the old value explicitly
    gen_max_people = case when p ? 'gen_max_people' then least(greatest((p->>'gen_max_people')::int, 1), 6) else gen_max_people end,
    gen_min_guests = case when p ? 'gen_min_guests' then least(greatest((p->>'gen_min_guests')::int, 2), 500) else gen_min_guests end,
    updated_at = now()
  where id;
end $function$
;

CREATE OR REPLACE FUNCTION public.face_work_waiting()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select faces_on from public.event_config), true) and (
    exists (select 1 from public.guests where face_status = 'pending' and selfie_path is not null)
      or (exists (select 1 from public.photos where faces_status = 'pending' and kind = 'party' and removed_at is null)
          and exists (select 1 from public.face_refs where embedding is not null)))
$function$
;

CREATE OR REPLACE FUNCTION public.face_claim(p_selfies integer DEFAULT 4, p_photos integer DEFAULT 6)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s jsonb; p jsonb := '[]'::jsonb;
begin
  insert into public.rostos_vivo (id, seen_at) values (1, now())
  on conflict (id) do update set seen_at = excluded.seen_at;
  -- recognition paused by the organizer: the reader finds nothing to do and stops on its own
  if not coalesce((select faces_on from public.event_config), true) then
    return jsonb_build_object('selfies', '[]'::jsonb, 'photos', '[]'::jsonb);
  end if;
  with c as (
    select id from public.guests
    where face_status = 'pending' and selfie_path is not null and (face_claimed_at is null or face_claimed_at < now() - interval '5 minutes')
    order by created_at limit p_selfies for update skip locked
  ), u as (
    update public.guests g set face_claimed_at = now() from c where g.id = c.id
    returning g.id, g.selfie_path
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'selfie_path', selfie_path)), '[]'::jsonb) into s from u;
  if exists (select 1 from public.face_refs where embedding is not null) then
    with c as (
      select id from public.photos
      where faces_status = 'pending' and kind = 'party' and removed_at is null
        and (faces_claimed_at is null or faces_claimed_at < now() - interval '5 minutes')
      order by created_at limit p_photos for update skip locked
    ), u as (
      update public.photos ph set faces_claimed_at = now() from c where ph.id = c.id
      returning ph.id, ph.original_path, ph.preview_path
    )
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'original_path', original_path, 'preview_path', preview_path)), '[]'::jsonb) into p from u;
  end if;
  return jsonb_build_object('selfies', s, 'photos', p);
end $function$
;
