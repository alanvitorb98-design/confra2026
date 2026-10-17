set check_function_bodies = off;

create extension if not exists pg_net with schema public;

create extension if not exists pg_trgm with schema extensions;

create extension if not exists pgcrypto with schema extensions;

create extension if not exists unaccent with schema extensions;

create extension if not exists "uuid-ossp" with schema extensions;

create extension if not exists vector with schema extensions;

create table public.admin_attempts (
  user_id uuid not null,
  at timestamp with time zone default now() not null
);

create table public.client_errors (
  id bigint generated always as identity not null,
  guest_id uuid,
  note text not null,
  user_agent text,
  at timestamp with time zone default now() not null
);

create table public.event_config (
  id boolean default true not null,
  look_opens timestamp with time zone default '2026-11-07 10:00:00+00'::timestamp with time zone not null,
  look_closes timestamp with time zone default '2026-11-07 15:00:00+00'::timestamp with time zone not null,
  party_starts timestamp with time zone default '2026-11-07 13:00:00+00'::timestamp with time zone not null,
  party_ends timestamp with time zone default '2026-11-07 23:00:00+00'::timestamp with time zone not null,
  test_mode boolean default true not null,
  app_opens timestamp with time zone default '2026-11-06 23:00:00+00'::timestamp with time zone not null,
  place text default 'Local da confra'::text not null,
  address text default ''::text not null,
  maps_url text default 'https://maps.app.goo.gl/hyafsQ7ASH6v94wcA'::text not null,
  updated_at timestamp with time zone default now() not null,
  lat double precision,
  lng double precision,
  face_worker_seen timestamp with time zone,
  gen_missions boolean default true not null,
  gen_min_guests integer default 15 not null,
  gen_max_people integer default 4 not null,
  gen_swaps integer default 3 not null
);

create table public.event_secret (
  id boolean default true not null,
  code text not null,
  admin_code text,
  face_hash text,
  vapid_public text,
  vapid_private text
);

create table public.face_extra (
  guest_id uuid not null,
  photo_id uuid not null,
  embedding vector(512),
  score real not null,
  by_hand boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table public.face_refs (
  guest_id uuid not null,
  embedding vector(512),
  updated_at timestamp with time zone default now() not null
);

create table public.face_vectors (
  photo_id uuid not null,
  idx integer not null,
  embedding vector(512) not null
);

create table public.guest_codes (
  guest_id uuid not null,
  code text not null,
  created_at timestamp with time zone default now() not null
);

create table public.guests (
  id uuid default gen_random_uuid() not null,
  name text not null,
  instagram text,
  face_opt_in boolean default false not null,
  token_hash text default (gen_random_uuid())::text not null,
  created_at timestamp with time zone default now() not null,
  user_id uuid,
  is_admin boolean default false not null,
  selfie_path text,
  face_status text default 'none'::text not null,
  terms_at timestamp with time zone,
  terms_version text,
  face_claimed_at timestamp with time zone
);

create table public.join_attempts (
  ip text not null,
  at timestamp with time zone default now() not null
);

create table public.live_dirty (
  tbl text not null,
  changed_at timestamp with time zone default '-infinity'::timestamp with time zone not null,
  sent_at timestamp with time zone default '-infinity'::timestamp with time zone not null
);

create table public.missions (
  id uuid default gen_random_uuid() not null,
  title text not null,
  points integer default 15 not null,
  active boolean default true not null,
  sort integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  target text,
  owner uuid,
  targets uuid[]
);

create table public.photo_faces (
  photo_id uuid not null,
  guest_id uuid not null,
  score real not null,
  by_hand text,
  updated_at timestamp with time zone default now() not null
);

create table public.photo_spots (
  id uuid default gen_random_uuid() not null,
  photo_id uuid not null,
  idx integer,
  x real not null,
  y real not null,
  w real default 0 not null,
  h real default 0 not null,
  guest_id uuid,
  by_hand boolean default false not null,
  removed boolean default false not null,
  tagged_by uuid,
  updated_at timestamp with time zone default now() not null,
  score real
);

create table public.photos (
  id uuid not null,
  guest_id uuid not null,
  kind text not null,
  caption text default ''::text not null,
  frame text default 'classic'::text not null,
  tilt real default 0 not null,
  original_path text not null,
  preview_path text not null,
  bytes bigint,
  created_at timestamp with time zone default now() not null,
  removed_at timestamp with time zone,
  mission_id uuid,
  faces_status text default 'pending'::text not null,
  mission_ok boolean,
  on_r2 boolean default false not null,
  rescan boolean default false not null,
  test boolean default false not null,
  updated_at timestamp with time zone default now() not null,
  faces_claimed_at timestamp with time zone,
  thumb_path text,
  thumb_url text,
  preview_url text,
  links_until timestamp with time zone
);

create table public.push_log (
  key text not null,
  sent_at timestamp with time zone default now() not null,
  sent integer default 0 not null
);

create table public.push_subs (
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default now() not null,
  last_ok timestamp with time zone,
  removed_at timestamp with time zone,
  guest_id uuid
);

create table public.r2_links (
  id uuid not null,
  guest_id uuid not null,
  thumb text,
  preview text,
  until timestamp with time zone not null,
  created_at timestamp with time zone default now() not null
);

create table public.reactions (
  photo_id uuid not null,
  guest_id uuid not null,
  emoji text not null,
  created_at timestamp with time zone default now() not null,
  active boolean default true not null
);

create table public.rostos_dispatch (
  op text not null,
  at timestamp with time zone default now() not null
);

create table public.rostos_vivo (
  id smallint default 1 not null,
  seen_at timestamp with time zone not null
);

create table public.saude_estado (
  item text not null,
  status text not null,
  texto text not null,
  desde timestamp with time zone default now() not null
);

alter table public.client_errors add constraint client_errors_pkey PRIMARY KEY (id);

alter table public.event_config add constraint event_config_id_check CHECK (id);

alter table public.event_config add constraint event_config_maps_https CHECK (((maps_url IS NULL) OR (maps_url = ''::text) OR (maps_url ~ '^https://'::text))) NOT VALID;

alter table public.event_config add constraint event_config_pkey PRIMARY KEY (id);

alter table public.event_secret add constraint event_secret_id_check CHECK (id);

alter table public.event_secret add constraint event_secret_pkey PRIMARY KEY (id);

alter table public.face_extra add constraint face_extra_pkey PRIMARY KEY (guest_id, photo_id);

alter table public.face_refs add constraint face_refs_pkey PRIMARY KEY (guest_id);

alter table public.face_vectors add constraint face_vectors_pkey PRIMARY KEY (photo_id, idx);

alter table public.guest_codes add constraint guest_codes_code_key UNIQUE (code);

alter table public.guest_codes add constraint guest_codes_pkey PRIMARY KEY (guest_id);

alter table public.guests add constraint guests_face_status_check CHECK ((face_status = ANY (ARRAY['none'::text, 'pending'::text, 'ready'::text, 'failed'::text])));

alter table public.guests add constraint guests_instagram_check CHECK ((instagram ~ '^[A-Za-z0-9._]{1,30}$'::text));

alter table public.guests add constraint guests_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 40)));

alter table public.guests add constraint guests_pkey PRIMARY KEY (id);

alter table public.guests add constraint guests_token_hash_key UNIQUE (token_hash);

alter table public.guests add constraint guests_user_id_key UNIQUE (user_id);

alter table public.live_dirty add constraint live_dirty_pkey PRIMARY KEY (tbl);

alter table public.missions add constraint missions_pkey PRIMARY KEY (id);

alter table public.missions add constraint missions_points_check CHECK (((points >= 1) AND (points <= 500)));

alter table public.missions add constraint missions_title_check CHECK (((char_length(title) >= 3) AND (char_length(title) <= 80)));

alter table public.photo_faces add constraint photo_faces_by_hand_check CHECK ((by_hand = ANY (ARRAY['add'::text, 'remove'::text])));

alter table public.photo_faces add constraint photo_faces_pkey PRIMARY KEY (photo_id, guest_id);

alter table public.photo_spots add constraint photo_spots_photo_id_idx_key UNIQUE (photo_id, idx);

alter table public.photo_spots add constraint photo_spots_pkey PRIMARY KEY (id);

alter table public.photos add constraint photos_caption_check CHECK ((char_length(caption) <= 140));

alter table public.photos add constraint photos_faces_status_check CHECK ((faces_status = ANY (ARRAY['pending'::text, 'done'::text, 'failed'::text, 'skip'::text])));

alter table public.photos add constraint photos_frame_check CHECK ((frame = ANY (ARRAY['classic'::text, 'gold'::text, 'dark'::text])));

alter table public.photos add constraint photos_kind_check CHECK ((kind = ANY (ARRAY['party'::text, 'look'::text])));

alter table public.photos add constraint photos_pkey PRIMARY KEY (id);

alter table public.photos add constraint photos_tilt_check CHECK (((tilt >= ('-4'::integer)::double precision) AND (tilt <= (4)::double precision)));

alter table public.push_log add constraint push_log_pkey PRIMARY KEY (key);

alter table public.push_subs add constraint push_subs_pkey PRIMARY KEY (endpoint);

alter table public.r2_links add constraint r2_links_pkey PRIMARY KEY (id);

alter table public.reactions add constraint reactions_emoji_check CHECK ((emoji = ANY (ARRAY['🔥'::text, '😂'::text, '😍'::text, '🥂'::text])));

alter table public.reactions add constraint reactions_pkey PRIMARY KEY (photo_id, guest_id, emoji);

alter table public.rostos_vivo add constraint rostos_vivo_pkey PRIMARY KEY (id);

alter table public.saude_estado add constraint saude_estado_pkey PRIMARY KEY (item);

alter table public.face_extra add constraint face_extra_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;

alter table public.face_extra add constraint face_extra_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE;

alter table public.face_refs add constraint face_refs_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;

alter table public.face_vectors add constraint face_vectors_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE;

alter table public.guest_codes add constraint guest_codes_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;

alter table public.guests add constraint guests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.missions add constraint missions_owner_fkey FOREIGN KEY (owner) REFERENCES guests(id) ON DELETE CASCADE;

alter table public.photo_faces add constraint photo_faces_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;

alter table public.photo_faces add constraint photo_faces_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE;

alter table public.photo_spots add constraint photo_spots_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL;

alter table public.photo_spots add constraint photo_spots_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE;

alter table public.photo_spots add constraint photo_spots_tagged_by_fkey FOREIGN KEY (tagged_by) REFERENCES guests(id) ON DELETE SET NULL;

alter table public.photos add constraint photos_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;

alter table public.photos add constraint photos_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES missions(id);

alter table public.push_subs add constraint push_subs_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL;

alter table public.r2_links add constraint r2_links_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;

alter table public.reactions add constraint reactions_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;

alter table public.reactions add constraint reactions_photo_id_fkey FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE;

CREATE INDEX admin_attempts_user_at ON public.admin_attempts USING btree (user_id, at);

CREATE INDEX face_extra_photo ON public.face_extra USING btree (photo_id);

CREATE INDEX guests_face_queue ON public.guests USING btree (created_at) WHERE ((face_status = 'pending'::text) AND (selfie_path IS NOT NULL));

CREATE INDEX join_attempts_ip_idx ON public.join_attempts USING btree (ip, at);

CREATE INDEX missions_owner ON public.missions USING btree (owner) WHERE (owner IS NOT NULL);

CREATE INDEX photo_faces_guest ON public.photo_faces USING btree (guest_id);

CREATE INDEX photo_faces_updated ON public.photo_faces USING btree (updated_at);

CREATE INDEX photo_spots_guest ON public.photo_spots USING btree (guest_id);

CREATE INDEX photo_spots_photo ON public.photo_spots USING btree (photo_id);

CREATE INDEX photo_spots_tagged_by ON public.photo_spots USING btree (tagged_by);

CREATE INDEX photos_created_idx ON public.photos USING btree (created_at DESC);

CREATE INDEX photos_face_queue ON public.photos USING btree (created_at) WHERE ((faces_status = 'pending'::text) AND (kind = 'party'::text) AND (removed_at IS NULL));

CREATE INDEX photos_faces_pending_idx ON public.photos USING btree (created_at) WHERE (faces_status = 'pending'::text);

CREATE INDEX photos_guest_idx ON public.photos USING btree (guest_id);

CREATE INDEX photos_links_until ON public.photos USING btree (links_until) WHERE (preview_url IS NOT NULL);

CREATE INDEX photos_mission_idx ON public.photos USING btree (mission_id);

CREATE INDEX photos_updated ON public.photos USING btree (updated_at);

CREATE INDEX reactions_created ON public.reactions USING btree (created_at);

CREATE INDEX reactions_guest_idx ON public.reactions USING btree (guest_id);

CREATE OR REPLACE FUNCTION public.admin_clear_photos()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int;
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  update public.photos set removed_at = now() where removed_at is null and test;
  get diagnostics n = row_count;
  update public.reactions r set active = false from public.photos p where p.id = r.photo_id and p.test and r.active;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_face_secret()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s text;
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  s := encode(extensions.gen_random_bytes(32), 'hex');
  update public.event_secret set face_hash = encode(extensions.digest(s, 'sha256'), 'hex') where id;
  return s;
end $function$
;

create or replace function public.admin_face_stats() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  return jsonb_build_object(
    'has_secret', (select face_hash is not null from public.event_secret),
    'worker_seen', greatest((select face_worker_seen from public.event_config), (select seen_at from public.rostos_vivo where id = 1)),
    'selfies', (select count(*) from public.guests where face_status = 'ready'),
    'pending', (select count(*) from public.photos where (faces_status = 'pending' or rescan) and kind = 'party' and removed_at is null)
  );
end $$;

CREATE OR REPLACE FUNCTION public.admin_mission(p_id uuid, p_title text, p_points integer, p_active boolean, p_sort integer, p_target text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v uuid;
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  if p_id is null then
    insert into public.missions (title, points, active, sort, target)
    values (trim(p_title), p_points, coalesce(p_active, true), coalesce(p_sort, 0), nullif(trim(coalesce(p_target, '')), '')) returning id into v;
  else
    update public.missions set title = trim(p_title), points = p_points, active = coalesce(p_active, active), sort = coalesce(p_sort, sort),
      target = nullif(trim(coalesce(p_target, '')), '') where id = p_id returning id into v;
    -- re-judge photos already posted for it
    update public.photos set mission_id = mission_id where mission_id = v;
  end if;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_save_mission(p_id uuid, p_title text, p_points integer, p_active boolean, p_sort integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v uuid;
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  if p_id is null then
    insert into public.missions (title, points, active, sort) values (trim(p_title), p_points, coalesce(p_active, true), coalesce(p_sort, 0)) returning id into v;
  else
    update public.missions set title = trim(p_title), points = p_points, active = coalesce(p_active, active), sort = coalesce(p_sort, sort) where id = p_id returning id into v;
  end if;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_secrets()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  return (select jsonb_build_object('code', code) from public.event_secret);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_set_code(p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  if char_length(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) < 6 then raise exception 'código curto'; end if;
  update public.event_secret set code = upper(trim(p_code)) where id;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  return jsonb_build_object(
    'guests', (select count(*) from public.guests),
    'photos', (select count(*) from public.photos where removed_at is null),
    'bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects where bucket_id = 'fotos')
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
    gen_missions = coalesce((p->>'gen_missions')::boolean, gen_missions),
    -- greatest/least skip nulls, so a missing field must keep the old value explicitly
    gen_max_people = case when p ? 'gen_max_people' then least(greatest((p->>'gen_max_people')::int, 1), 6) else gen_max_people end,
    gen_min_guests = case when p ? 'gen_min_guests' then least(greatest((p->>'gen_min_guests')::int, 2), 500) else gen_min_guests end,
    updated_at = now()
  where id;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_wipe_faces()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  update public.face_refs set embedding = null, updated_at = now() where embedding is not null;
  update public.face_extra set embedding = null where embedding is not null;
  update public.photo_faces set score = -1 where score > 0 and by_hand is null;
  update public.photo_spots set guest_id = null where guest_id is not null and not by_hand;
  update public.guests set face_status = 'none', selfie_path = null where face_status <> 'none' or selfie_path is not null;
  update public.photos set faces_status = 'skip' where faces_status = 'pending';
end $function$
;

CREATE OR REPLACE FUNCTION public.claim_admin(p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.event_secret;
begin
  if auth.uid() is null then return false; end if;
  if (select count(*) from public.admin_attempts where user_id = auth.uid() and at > now() - interval '1 hour') >= 5 then
    raise exception 'muitas tentativas, tenta de novo daqui a pouco';
  end if;
  select * into s from public.event_secret;
  if s.admin_code is null or upper(trim(coalesce(p_code, ''))) <> s.admin_code then
    insert into public.admin_attempts (user_id) values (auth.uid());
    return false;
  end if;
  update public.guests set is_admin = true where user_id = auth.uid();
  return found;
end $function$
;

CREATE OR REPLACE FUNCTION public.drop_push(p_endpoint text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update public.push_subs set removed_at = now() where endpoint = p_endpoint;
$function$
;

CREATE OR REPLACE FUNCTION public.drop_push(p_endpoint text, p_auth text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update public.push_subs set removed_at = now() where endpoint = p_endpoint and auth = p_auth;
$function$
;

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
    'place', c.place, 'address', c.address, 'maps_url', c.maps_url, 'lat', c.lat, 'lng', c.lng
  );
end $function$
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

CREATE OR REPLACE FUNCTION public.face_match(p_photo uuid, p_threshold real DEFAULT 0.42)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int;
begin
  insert into public.photo_faces (photo_id, guest_id, score)
  select distinct on (best.guest_id) p_photo, best.guest_id, best.score
  from public.face_vectors v
  cross join lateral (
    select r.guest_id, (1 - (r.embedding operator(extensions.<=>) v.embedding))::real as score
    from public.face_refs r join public.guests g on g.id = r.guest_id
    where r.embedding is not null and g.face_opt_in
    order by r.embedding operator(extensions.<=>) v.embedding
    limit 1
  ) best
  where v.photo_id = p_photo and best.score >= p_threshold
  order by best.guest_id, best.score desc
  on conflict (photo_id, guest_id) do update set score = greatest(public.photo_faces.score, excluded.score);
  get diagnostics n = row_count;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.face_opt_out()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g uuid;
begin
  g := public.my_guest();
  update public.guests set face_opt_in = false, face_status = 'none', selfie_path = null where id = g;
  update public.face_refs set embedding = null, updated_at = now() where guest_id = g;
  update public.face_extra set embedding = null where guest_id = g and embedding is not null;
  update public.photo_faces set score = -1 where guest_id = g and by_hand is null;
  update public.photo_spots set guest_id = null where guest_id = g and not by_hand;
end $function$
;

CREATE OR REPLACE FUNCTION public.face_promote_rescan(p_batch integer DEFAULT 10)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int := 0;
begin
  if exists (select 1 from public.photos where faces_status = 'pending' and kind = 'party' and removed_at is null) then
    return 0;
  end if;
  update public.photos set faces_status = 'pending', rescan = false
  where id in (select id from public.photos where rescan and removed_at is null and kind = 'party' order by created_at desc limit p_batch);
  get diagnostics n = row_count;
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.face_rows(p_faces jsonb)
 RETURNS TABLE(idx integer, v vector, b jsonb)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select (t.o - 1)::int, ((t.e -> 'e')::text)::extensions.vector(512), t.e -> 'b'
  from jsonb_array_elements(coalesce(p_faces, '[]'::jsonb)) with ordinality t(e, o)
$function$
;

CREATE OR REPLACE FUNCTION public.face_save_faces(p_photo uuid, p_faces jsonb, p_threshold real DEFAULT 0.42)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int;
  learn_at constant real := 0.6;
  hand_min constant real := 0.3;
  most constant int := 12;
begin
  with refs as (
    select r.guest_id, r.embedding from public.face_refs r where r.embedding is not null
    union all
    select x.guest_id, x.embedding from public.face_extra x where x.embedding is not null and x.photo_id <> p_photo
  ), best as (
    select f.idx, f.b, m.guest_id, m.score
    from public.face_rows(p_faces) f left join lateral (
      select r.guest_id, (1 - (r.embedding operator(extensions.<=>) f.v))::real as score
      from refs r join public.guests g on g.id = r.guest_id
      where g.face_opt_in
        and not exists (select 1 from public.photo_spots s where s.photo_id = p_photo and s.by_hand and not s.removed and s.guest_id = r.guest_id)
      order by r.embedding operator(extensions.<=>) f.v
      limit 1
    ) m on true
  ), ranked as (
    select *, coalesce(score >= p_threshold, false) and row_number() over (partition by guest_id order by score desc) = 1 as hit
    from best
  ), spots as (
    insert into public.photo_spots (photo_id, idx, x, y, w, h, guest_id, score)
    select p_photo, idx, (b ->> 0)::real, (b ->> 1)::real, (b ->> 2)::real, (b ->> 3)::real, case when hit then guest_id end, case when hit then score end
    from ranked where jsonb_typeof(b) = 'array' and jsonb_array_length(b) = 4
    on conflict (photo_id, idx) do update set
      x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h, updated_at = now(),
      guest_id = case when public.photo_spots.by_hand then public.photo_spots.guest_id else excluded.guest_id end,
      score = case when public.photo_spots.by_hand then public.photo_spots.score else excluded.score end
    returning 1
  ), boxless as (
    insert into public.photo_faces (photo_id, guest_id, score)
    select p_photo, guest_id, score from ranked where hit and jsonb_typeof(b) is distinct from 'array'
    on conflict (photo_id, guest_id) do update set score = greatest(public.photo_faces.score, excluded.score)
      where public.photo_faces.by_hand is null
    returning 1
  )
  select count(*) into n from ranked where hit;
  insert into public.photo_faces (photo_id, guest_id, score, by_hand)
  select p_photo, s.guest_id, coalesce(s.score, p_threshold), null from public.photo_spots s
  where s.photo_id = p_photo and s.guest_id is not null and not s.by_hand and not s.removed
  on conflict (photo_id, guest_id) do update set score = excluded.score, by_hand = null
    where public.photo_faces.by_hand is distinct from 'add';
  update public.face_extra set embedding = null where photo_id = p_photo and embedding is not null;
  insert into public.face_extra (guest_id, photo_id, embedding, score, by_hand)
  select distinct on (s.guest_id) s.guest_id, p_photo, f.v, k.score, s.by_hand
  from public.photo_spots s
  join public.guests g on g.id = s.guest_id and g.face_opt_in
  join public.face_rows(p_faces) f on f.idx = s.idx
  cross join lateral (
    select max((1 - (r.embedding operator(extensions.<=>) f.v))::real) as score
    from (select embedding from public.face_refs where guest_id = s.guest_id and embedding is not null
          union all select embedding from public.face_extra where guest_id = s.guest_id and embedding is not null) r
  ) k
  cross join lateral (
    select (1 - (r.embedding operator(extensions.<=>) f.v))::real as score
    from public.face_refs r where r.guest_id = s.guest_id and r.embedding is not null
  ) me
  where s.photo_id = p_photo and not s.removed and s.idx is not null
    and me.score >= hand_min and (s.by_hand or k.score >= learn_at)
    and k.score < 0.95
    and (select count(*) from public.face_extra x where x.guest_id = s.guest_id and x.embedding is not null) < most
  order by s.guest_id, k.score desc
  on conflict (guest_id, photo_id) do update set embedding = excluded.embedding, score = excluded.score, by_hand = excluded.by_hand, created_at = now();
  update public.photos set faces_status = 'done' where id = p_photo;
  perform public.face_promote_rescan();
  return n;
end $function$
;

CREATE OR REPLACE FUNCTION public.face_save_photo(p_photo uuid, p_embeddings jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare i int := 0; e jsonb;
begin
  for e in select * from jsonb_array_elements(coalesce(p_embeddings, '[]'::jsonb)) loop
    insert into public.face_vectors (photo_id, idx, embedding) values (p_photo, i, (e::text)::extensions.vector)
    on conflict (photo_id, idx) do update set embedding = excluded.embedding;
    i := i + 1;
  end loop;
  update public.photos set faces_status = 'done' where id = p_photo;
  return public.face_match(p_photo);
end $function$
;

CREATE OR REPLACE FUNCTION public.face_save_photo(p_photo uuid, p_embeddings jsonb, p_threshold real DEFAULT 0.42)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n int;
begin
  insert into public.photo_faces (photo_id, guest_id, score)
  select distinct on (best.guest_id) p_photo, best.guest_id, best.score
  from jsonb_array_elements(coalesce(p_embeddings, '[]'::jsonb)) e
  cross join lateral (select (e::text)::extensions.vector(512) as v) q
  cross join lateral (
    select r.guest_id, (1 - (r.embedding operator(extensions.<=>) q.v))::real as score
    from public.face_refs r join public.guests g on g.id = r.guest_id
    where r.embedding is not null and g.face_opt_in
    order by r.embedding operator(extensions.<=>) q.v
    limit 1
  ) best
  where best.score >= p_threshold
  order by best.guest_id, best.score desc
  on conflict (photo_id, guest_id) do update set score = greatest(public.photo_faces.score, excluded.score)
    where public.photo_faces.by_hand is null;
  get diagnostics n = row_count;
  update public.photos set faces_status = 'done' where id = p_photo;
  perform public.face_promote_rescan();
  return n;
end $function$
;

create or replace function public.face_save_selfie(p_guest uuid, p_embedding jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not exists (select 1 from public.guests where id = p_guest and face_opt_in) then return 0; end if;
  if p_embedding is null or jsonb_typeof(p_embedding) <> 'array' then
    update public.guests set face_status = 'failed' where id = p_guest;
    return 0;
  end if;
  insert into public.face_refs (guest_id, embedding, updated_at) values (p_guest, (p_embedding::text)::extensions.vector, now())
  on conflict (guest_id) do update set embedding = excluded.embedding, updated_at = now();
  update public.guests set face_status = 'ready' where id = p_guest;
  -- look for this guest in photos posted before the selfie, after the new photos in the queue
  update public.photos set rescan = true where removed_at is null and faces_status = 'done' and kind = 'party';
  get diagnostics n = row_count;
  perform public.face_promote_rescan();
  return n;
end $$;

CREATE OR REPLACE FUNCTION public.face_work_waiting()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.guests where face_status = 'pending' and selfie_path is not null)
      or (exists (select 1 from public.photos where faces_status = 'pending' and kind = 'party' and removed_at is null)
          and exists (select 1 from public.face_refs where embedding is not null))
$function$
;

create or replace function public.faces_since(p_since timestamptz)
returns table(photo_id uuid, guest_id uuid, shown boolean, at timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.photo_id, f.guest_id, f.score > 0, f.updated_at
  from public.photo_faces f
  where (select public.is_guest()) and f.updated_at > p_since
    and (f.score > 0 or f.updated_at > now() - interval '1 day')
$$;

CREATE OR REPLACE FUNCTION public.faces_sync(p_photo uuid, p_guest uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_guest is null then return; end if;
  if exists (select 1 from public.photo_spots where photo_id = p_photo and guest_id = p_guest and not removed) then
    insert into public.photo_faces (photo_id, guest_id, score, by_hand) values (p_photo, p_guest, 1, 'add')
    on conflict (photo_id, guest_id) do update set score = 1, by_hand = 'add' where public.photo_faces.score <= 0;
    if exists (select 1 from public.photo_spots where photo_id = p_photo and guest_id = p_guest and by_hand and not removed) then
      update public.face_extra set embedding = null where photo_id = p_photo and guest_id = p_guest and embedding is not null;
      if exists (select 1 from public.photo_spots s join public.guests g on g.id = s.guest_id
                 where s.photo_id = p_photo and s.guest_id = p_guest and s.by_hand and not s.removed and s.idx is not null and g.face_opt_in)
         and not exists (select 1 from public.face_extra where photo_id = p_photo and guest_id = p_guest and embedding is not null) then
        update public.photos set rescan = true where id = p_photo and faces_status = 'done' and mission_id is null;
      end if;
    end if;
  else
    update public.photo_faces set score = -1, by_hand = 'remove' where photo_id = p_photo and guest_id = p_guest and score > 0;
    update public.face_extra set embedding = null where photo_id = p_photo and guest_id = p_guest and embedding is not null;
  end if;
  update public.photos set faces_status = faces_status where id = p_photo and mission_id is not null;
end $function$
;

CREATE OR REPLACE FUNCTION public.guest_for(p_token text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select id from public.guests where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
$function$
;

CREATE OR REPLACE FUNCTION public.hide_photo(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.photos set removed_at = now()
  where id = p_id and (guest_id = public.my_guest() or public.is_admin());
end $function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select coalesce((select is_admin from public.guests where user_id = auth.uid()), false) $function$
;

CREATE OR REPLACE FUNCTION public.is_guest()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select exists (select 1 from public.guests where user_id = auth.uid()) $function$
;

CREATE OR REPLACE FUNCTION public.join_party(p_token text, p_name text, p_instagram text, p_face boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g uuid;
begin
  if char_length(coalesce(p_token, '')) < 32 then raise exception 'token inválido'; end if;
  g := public.guest_for(p_token);
  if g is not null then
    update public.guests set name = trim(p_name), instagram = nullif(trim(p_instagram), ''), face_opt_in = coalesce(p_face, false) where id = g;
    return g;
  end if;
  insert into public.guests (name, instagram, face_opt_in, token_hash)
  values (trim(p_name), nullif(trim(p_instagram), ''), coalesce(p_face, false), encode(extensions.digest(p_token, 'sha256'), 'hex'))
  returning id into g;
  return g;
end $function$
;

create or replace function public.live_flush() returns void
language plpgsql security definer set search_path = '' as $$
declare r record; t text[] := '{}';
begin
  if not pg_try_advisory_xact_lock(4207) then return; end if;
  for r in select tbl, changed_at from public.live_dirty where changed_at > sent_at loop
    t := t || r.tbl;
    update public.live_dirty set sent_at = r.changed_at where tbl = r.tbl;
  end loop;
  if cardinality(t) > 0 then
    perform realtime.send(jsonb_build_object('t', t), 'tick', 'live', true);
  end if;
end $$;

create or replace function public.live_mark_photos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from n join o using (id) where n.updated_at is distinct from o.updated_at) then
    update public.live_dirty set changed_at = clock_timestamp() where tbl = 'photos';
  end if;
  return null;
end $$;

CREATE OR REPLACE FUNCTION public.live_mark()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.live_dirty set changed_at = clock_timestamp() where tbl = tg_table_name;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.log_client_error(p_note text, p_ua text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_guest() then return; end if;
  if (select count(*) from public.client_errors where at > now() - interval '1 hour') >= 500 then return; end if;
  insert into public.client_errors (guest_id, note, user_agent)
  values ((select id from public.guests where user_id = auth.uid()), left(coalesce(p_note, ''), 300), left(p_ua, 200));
end $function$
;

CREATE OR REPLACE FUNCTION public.mission_verdict()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare t text; tg uuid[]; own uuid;
begin
  if new.mission_id is null then new.mission_ok := null; return new; end if;
  select nullif(trim(target), ''), targets, owner into t, tg, own from public.missions where id = new.mission_id;
  if tg is not null then
    if own is distinct from new.guest_id then new.mission_ok := false;
    elsif new.faces_status = 'done' then
      new.mission_ok := not exists (
        select 1 from unnest(tg) x(id)
        where not exists (select 1 from public.photo_faces pf where pf.photo_id = new.id and pf.guest_id = x.id and pf.score > 0 and pf.by_hand is null)
      );
    elsif new.faces_status = 'failed' then new.mission_ok := false;
    else new.mission_ok := null;
    end if;
    return new;
  end if;
  if t is null then new.mission_ok := true; return new; end if;
  if new.faces_status = 'done' then
    new.mission_ok := exists (
      select 1 from public.photo_faces pf join public.guests g on g.id = pf.guest_id
      where pf.photo_id = new.id and pf.score > 0 and pf.by_hand is null and pf.guest_id <> new.guest_id and public.name_matches(g.name, t)
    );
  elsif new.faces_status = 'failed' or not public.target_has_face(t, new.guest_id) then
    new.mission_ok := false;
  else
    new.mission_ok := null;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.my_face_progress()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'status', g.face_status,
    'reading', g.face_claimed_at is not null,
    'worker', exists (select 1 from public.rostos_vivo where seen_at > now() - interval '40 seconds'),
    'ahead', (select count(*) from public.guests o
              where o.face_status = 'pending' and o.selfie_path is not null and o.face_claimed_at is null
                and o.created_at < g.created_at and o.id <> g.id))
  from public.guests g where g.id = public.my_guest()
$function$
;

CREATE OR REPLACE FUNCTION public.my_guest()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ select id from public.guests where user_id = auth.uid() $function$
;

CREATE OR REPLACE FUNCTION public.my_return_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g uuid := public.my_guest(); c text; abc constant text := 'ACDEFGHJKMNPQRTUVWXY3479';
begin
  if g is null then raise exception 'faça login'; end if;
  select code into c from public.guest_codes where guest_id = g;
  while c is null loop
    select string_agg(substr(abc, 1 + get_byte(b, i) % length(abc), 1), '' order by i) into c
    from (select extensions.gen_random_bytes(6) as b) r, generate_series(0, 5) i;
    begin
      insert into public.guest_codes (guest_id, code) values (g, c);
    exception when unique_violation then
      c := null;
      select code into c from public.guest_codes where guest_id = g;
    end;
  end loop;
  return c;
end $function$
;

CREATE OR REPLACE FUNCTION public.name_matches(p_name text, p_target text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with n as (
    select lower(extensions.unaccent(trim(coalesce(p_name, '')))) a, lower(extensions.unaccent(trim(coalesce(p_target, '')))) b
  )
  select b <> '' and a <> '' and (
    a like '%' || b || '%'
    or (length(split_part(a, ' ', 1)) >= 3 and b like '%' || split_part(a, ' ', 1) || '%')
    or extensions.similarity(a, b) >= 0.4
    or extensions.word_similarity(b, a) >= 0.6
  ) from n;
$function$
;

CREATE OR REPLACE FUNCTION public.people_draw(p_me uuid, n integer, p_skip uuid[])
 RETURNS uuid[]
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(array_agg(id), '{}') from (
    select g.id from public.guests g
    where g.id <> p_me and g.face_opt_in and not (g.id = any(coalesce(p_skip, '{}')))
      and exists (select 1 from public.face_refs r where r.guest_id = g.id and r.embedding is not null)
    order by
      (select count(*) from public.missions m where m.owner = p_me and g.id = any(m.targets)),
      (select count(*) from public.missions m where m.active and g.id = any(m.targets)),
      random()
    limit greatest(n, 0)
  ) s
$function$
;

CREATE OR REPLACE FUNCTION public.people_insert(p_me uuid, p_targets uuid[], p_sort integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare names text[]; mid uuid;
begin
  select array_agg(g.name order by x.ord) into names
  from unnest(p_targets) with ordinality x(id, ord) join public.guests g on g.id = x.id;
  insert into public.missions (title, points, active, sort, owner, targets)
  values (public.people_title(names), public.people_points(cardinality(p_targets)), true, p_sort, p_me, p_targets)
  returning id into mid;
  return mid;
end $function$
;

CREATE OR REPLACE FUNCTION public.people_mission()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := public.my_guest();
  cfg public.event_config;
  open_id uuid;
  done_n int;
  total int;
  picked uuid[];
begin
  if me is null then raise exception 'not a guest'; end if;
  select * into cfg from public.event_config limit 1;
  if not coalesce(cfg.gen_missions, true) then return jsonb_build_object('id', null, 'off', true); end if;
  perform pg_advisory_xact_lock(hashtext('people_mission:' || me));

  select m.id into open_id from public.missions m
  where m.owner = me and m.active
    and not exists (select 1 from public.photos p where p.mission_id = m.id and p.guest_id = me and p.mission_ok and p.removed_at is null)
  order by m.created_at desc limit 1;
  if open_id is not null then return jsonb_build_object('id', open_id); end if;

  select count(*) into total from public.guests;
  if total < cfg.gen_min_guests then return jsonb_build_object('id', null, 'need', cfg.gen_min_guests - total); end if;

  select count(*) into done_n from public.missions m
  where m.owner = me and exists (select 1 from public.photos p where p.mission_id = m.id and p.guest_id = me and p.mission_ok and p.removed_at is null);

  picked := public.people_draw(me, least(1 + done_n / 2, cfg.gen_max_people), null);
  if cardinality(picked) = 0 then return jsonb_build_object('id', null, 'need', 1); end if;
  return jsonb_build_object('id', public.people_insert(me, picked, 1000 + done_n));
end $function$
;

CREATE OR REPLACE FUNCTION public.people_points(n integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$ select (array[10, 25, 45, 70, 100, 135])[least(greatest(n, 1), 6)] $function$
;

CREATE OR REPLACE FUNCTION public.people_swap(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me uuid := public.my_guest(); m public.missions; used int; cfg public.event_config; picked uuid[];
begin
  if me is null then raise exception 'not a guest'; end if;
  perform pg_advisory_xact_lock(hashtext('people_mission:' || me));
  select * into m from public.missions where id = p_id and owner = me and active;
  if not found then raise exception 'mission not open'; end if;
  if exists (select 1 from public.photos p where p.mission_id = p_id and p.guest_id = me and p.mission_ok and p.removed_at is null) then
    raise exception 'mission already done';
  end if;
  select * into cfg from public.event_config limit 1;
  select count(*) into used from public.missions x where x.owner = me and not x.active;
  if used >= cfg.gen_swaps then raise exception 'no swaps left'; end if;
  picked := public.people_draw(me, cardinality(m.targets), m.targets);
  if cardinality(picked) < cardinality(m.targets) then raise exception 'nobody else to draw'; end if;
  update public.missions set active = false where id = p_id;
  return jsonb_build_object('id', public.people_insert(me, picked, m.sort), 'swaps_left', cfg.gen_swaps - used - 1);
end $function$
;

CREATE OR REPLACE FUNCTION public.people_title(p_names text[])
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select 'Foto com ' || case
    when cardinality(p_names) = 1 then p_names[1]
    else array_to_string(p_names[1:cardinality(p_names) - 1], ', ') || ' e ' || p_names[cardinality(p_names)]
  end
$function$
;

CREATE OR REPLACE FUNCTION public.photo_store()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare l public.r2_links; t text := regexp_replace(new.preview_path, '-p\.jpg$', '-t.jpg');
begin
  new.on_r2 := not exists (select 1 from storage.objects o where o.bucket_id = 'fotos' and o.name = new.original_path);
  if exists (select 1 from storage.objects o where o.bucket_id = 'fotos' and o.name = new.preview_path) then
    if t <> new.preview_path and exists (select 1 from storage.objects o where o.bucket_id = 'fotos' and o.name = t) then
      new.thumb_path := t;
    end if;
  else
    select * into l from public.r2_links where id = new.id and guest_id = new.guest_id;
    if found then
      new.thumb_url := l.thumb;
      new.preview_url := l.preview;
      new.links_until := l.until;
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.ping()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select true $function$
;

CREATE OR REPLACE FUNCTION public.post_photo(p_token text, p_id uuid, p_kind text, p_caption text, p_frame text, p_tilt real, p_original text, p_preview text, p_bytes bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g uuid; c public.event_config; n int;
begin
  g := public.guest_for(p_token);
  if g is null then raise exception 'convidado não encontrado'; end if;
  select * into c from public.event_config;
  if not c.test_mode then
    if p_kind = 'look' and not (now() >= c.look_opens and now() < c.look_closes) then raise exception 'looks fechados'; end if;
    if p_kind = 'party' and not (now() >= c.party_starts and now() < c.party_ends) then raise exception 'câmera fechada'; end if;
  end if;
  if p_original not like p_kind || '/' || g || '/' || p_id || '%' or p_preview not like p_kind || '/' || g || '/' || p_id || '%' then
    raise exception 'caminho inválido';
  end if;
  select count(*) into n from public.photos where guest_id = g;
  if n >= 300 then raise exception 'limite de fotos'; end if;
  -- one outfit per guest: a new look hides the old one
  if p_kind = 'look' then
    update public.photos set removed_at = now() where guest_id = g and kind = 'look' and removed_at is null;
  end if;
  insert into public.photos (id, guest_id, kind, caption, frame, tilt, original_path, preview_path, bytes)
  values (p_id, g, p_kind, left(coalesce(p_caption, ''), 140), p_frame, greatest(-4, least(4, coalesce(p_tilt, 0))), p_original, p_preview, p_bytes);
end $function$
;

CREATE OR REPLACE FUNCTION public.push_alive(p_endpoint text, p_auth text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g uuid := public.my_guest();
begin
  if g is not null then
    update public.push_subs set guest_id = g where endpoint = p_endpoint and auth = p_auth and removed_at is null and guest_id is distinct from g;
  end if;
  return exists (select 1 from public.push_subs where endpoint = p_endpoint and auth = p_auth and removed_at is null);
end $function$
;

CREATE OR REPLACE FUNCTION public.react(p_photo uuid, p_emoji text, p_force boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g uuid; v boolean;
begin
  g := public.my_guest();
  if g is null then raise exception 'convidado não encontrado'; end if;
  insert into public.reactions as r (photo_id, guest_id, emoji, active) values (p_photo, g, p_emoji, true)
  on conflict (photo_id, guest_id, emoji) do update set active = p_force or not r.active, created_at = now()
  returning active into v;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.remove_photo(p_token text, p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.photos set removed_at = now() where id = p_id and guest_id = public.guest_for(p_token);
end $function$
;

CREATE OR REPLACE FUNCTION public.rostos_allow(p_op text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare gap interval := case p_op when 'party' then interval '5 hours' when 'drain' then interval '4 minutes' else interval '5 minutes' end;
begin
  perform pg_advisory_xact_lock(hashtext('rostos_dispatch'));
  if p_op = 'drain' and not public.face_work_waiting() then return false; end if;
  if exists (select 1 from public.rostos_dispatch where op = p_op and at > now() - gap) then return false; end if;
  insert into public.rostos_dispatch (op) values (p_op);
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.rostos_chamar()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.face_work_waiting() then return 'vazio'; end if;
  if exists (select 1 from public.rostos_vivo where seen_at > now() - interval '1 minute') then return 'rodando'; end if;
  if exists (select 1 from public.rostos_dispatch where op in ('drain', 'party') and at > now() - interval '4 minutes') then return 'ligando'; end if;
  perform net.http_post('https://optapzbhyhklcirdoyid.supabase.co/functions/v1/rostos-cron?op=drain', '{}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb);
  return 'chamado';
end $function$
;

CREATE OR REPLACE FUNCTION public.rostos_chamar_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.rostos_chamar();
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION public.saude_medir()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  c public.event_config;
  out jsonb := '[]';
  mb numeric;
  n numeric;
  m numeric;
  festa boolean;
  pct numeric;
  st text;
begin
  select * into c from public.event_config;
  festa := now() between c.party_starts - interval '30 minutes' and c.party_ends + interval '2 hours';

  mb := pg_database_size(current_database()) / 1048576.0;
  pct := mb / 500 * 100;
  out := out || jsonb_build_object('item', 'banco', 'pct', round(pct), 'texto', format('Banco: %s MB de 500 MB (%s%%)', round(mb), round(pct)));
  mb := coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0) / 1048576.0;
  pct := mb / 1024 * 100;
  out := out || jsonb_build_object('item', 'arquivos', 'pct', round(pct), 'texto', format('Arquivos no Supabase: %s MB de 1 GB (%s%%)', round(mb), round(pct)));
  mb := coalesce((select sum(bytes) from public.photos where on_r2), 0) / 1048576.0;
  pct := mb / 10240 * 100;
  out := out || jsonb_build_object('item', 'r2', 'pct', round(pct), 'texto', format('Originais (Cloudflare): %s GB de 10 GB (%s%%)', round(mb / 1024, 1), round(pct)));

  n := (select count(*) from pg_stat_activity);
  m := current_setting('max_connections')::numeric;
  pct := n / m * 100;
  out := out || jsonb_build_object('item', 'conexoes', 'pct', round(pct), 'texto', format('Conexões do banco: %s de %s', n, m));

  n := extract(epoch from now() - coalesce((
    select max(r.end_time) from cron.job_run_details r
    where r.jobid = (select jobid from cron.job where jobname = 'ao-vivo') and r.status = 'succeeded'
      and r.runid > (select coalesce(max(runid), 0) - 200 from cron.job_run_details)
  ), '-infinity'));
  st := case when n > 120 then 'critico' when n > 30 then 'atencao' else 'ok' end;
  out := out || jsonb_build_object('item', 'ao_vivo', 'status', st,
    'texto', case when st = 'ok' then 'Ao vivo: funcionando' else format('Ao vivo: parado há %s min', round(least(n, 99999) / 60)) end);

  if festa and exists (select 1 from public.face_refs where embedding is not null) then
    n := coalesce(extract(epoch from now() - (select min(created_at) from public.photos where faces_status = 'pending' and kind = 'party' and removed_at is null)) / 60, 0);
    st := case when n > 45 then 'critico' when n > 20 then 'atencao' else 'ok' end;
    out := out || jsonb_build_object('item', 'rostos', 'status', st,
      'texto', case when n = 0 then 'Reconhecimento: fila vazia' else format('Reconhecimento: foto mais antiga esperando há %s min', round(n)) end);
  end if;

  n := (select count(*) from public.client_errors where at > now() - interval '15 minutes');
  st := case when n >= 50 then 'critico' when n >= 10 then 'atencao' else 'ok' end;
  out := out || jsonb_build_object('item', 'erros', 'status', st, 'texto', format('Erros nos celulares (15 min): %s', n));

  return (
    select jsonb_agg(case when e ? 'status' then e
      else e || jsonb_build_object('status', case when (e->>'pct')::numeric >= 90 then 'critico' when (e->>'pct')::numeric >= 70 then 'atencao' else 'ok' end) end)
    from jsonb_array_elements(out) e
  );
end $function$
;

CREATE OR REPLACE FUNCTION public.save_push(p_code text, p_endpoint text, p_p256dh text, p_auth text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_endpoint !~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]*\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]*\.notify\.windows\.com|[a-z0-9.-]*\.push\.samsungosp\.com)/'
     or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'inscrição inválida';
  end if;
  if (select count(*) from public.push_subs where removed_at is null) >= 3000 then raise exception 'limite'; end if;
  insert into public.push_subs (endpoint, p256dh, auth, guest_id) values (p_endpoint, p_p256dh, p_auth, public.my_guest())
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, removed_at = null,
    guest_id = coalesce(excluded.guest_id, public.push_subs.guest_id);
  return true;
end $function$
;

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

CREATE OR REPLACE FUNCTION public.set_selfie(p_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g uuid;
begin
  g := public.my_guest();
  if g is null or p_path not like 'selfie/' || g || '/%' then raise exception 'selfie inválida'; end if;
  update public.guests set selfie_path = p_path, face_status = 'pending', face_opt_in = true, face_claimed_at = null where id = g;
end $function$
;

CREATE OR REPLACE FUNCTION public.share_photo(p_id uuid, p_kind text, p_caption text, p_frame text, p_tilt real, p_original text, p_preview text, p_bytes bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g uuid; c public.event_config; n int;
begin
  g := public.my_guest();
  if g is null then raise exception 'convidado não encontrado'; end if;
  select * into c from public.event_config;
  if not c.test_mode then
    if p_kind = 'look' and not (now() >= c.look_opens and now() < c.look_closes) then raise exception 'looks fechados'; end if;
    if p_kind = 'party' and not (now() >= c.party_starts and now() < c.party_ends) then raise exception 'câmera fechada'; end if;
  end if;
  if p_original not like p_kind || '/' || g || '/' || p_id || '%' or p_preview not like p_kind || '/' || g || '/' || p_id || '%' then
    raise exception 'caminho inválido';
  end if;
  select count(*) into n from public.photos where guest_id = g;
  if n >= 300 then raise exception 'limite de fotos'; end if;
  if p_kind = 'look' then
    update public.photos set removed_at = now() where guest_id = g and kind = 'look' and removed_at is null;
  end if;
  insert into public.photos (id, guest_id, kind, caption, frame, tilt, original_path, preview_path, bytes)
  values (p_id, g, p_kind, left(coalesce(p_caption, ''), 140), p_frame, greatest(-4, least(4, coalesce(p_tilt, 0))), p_original, p_preview, p_bytes);
end $function$
;

CREATE OR REPLACE FUNCTION public.tag_spot(p_photo uuid, p_spot uuid, p_x real, p_y real, p_guest uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := public.my_guest(); old uuid;
begin
  if me is null then raise exception 'faça login'; end if;
  if not exists (select 1 from public.photos where id = p_photo and removed_at is null and (guest_id = me or public.is_admin())) then
    raise exception 'só quem tirou a foto marca';
  end if;
  if p_guest is not null and not exists (select 1 from public.guests where id = p_guest) then raise exception 'convidado não encontrado'; end if;
  if p_spot is null then
    if p_guest is null then return null; end if;
    if p_x is null or p_y is null or p_x < 0 or p_x > 1 or p_y < 0 or p_y > 1 then raise exception 'ponto fora da foto'; end if;
    if (select count(*) from public.photo_spots where photo_id = p_photo) >= 80 then raise exception 'marcações demais'; end if;
    insert into public.photo_spots (photo_id, x, y, guest_id, by_hand, tagged_by) values (p_photo, p_x, p_y, p_guest, true, me)
    returning id into p_spot;
  else
    select guest_id into old from public.photo_spots where id = p_spot and photo_id = p_photo and not removed for update;
    if not found then raise exception 'marcação não encontrada'; end if;
    update public.photo_spots set guest_id = p_guest, by_hand = true, tagged_by = me, updated_at = now(),
      removed = (p_guest is null and idx is null)
    where id = p_spot;
  end if;
  if p_guest is not null then
    update public.photo_spots set guest_id = null, by_hand = true, removed = (idx is null), updated_at = now()
    where photo_id = p_photo and guest_id = p_guest and id <> p_spot;
  end if;
  perform public.faces_sync(p_photo, old);
  perform public.faces_sync(p_photo, p_guest);
  return p_spot;
end $function$
;

CREATE OR REPLACE FUNCTION public.target_has_face(p_target text, p_author uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.guests g join public.face_refs r on r.guest_id = g.id
    where g.face_opt_in and r.embedding is not null and g.id <> p_author and public.name_matches(g.name, p_target)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.toggle_reaction(p_token text, p_photo uuid, p_emoji text, p_force boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g uuid; v boolean;
begin
  g := public.guest_for(p_token);
  if g is null then raise exception 'convidado não encontrado'; end if;
  insert into public.reactions as r (photo_id, guest_id, emoji, active) values (p_photo, g, p_emoji, true)
  on conflict (photo_id, guest_id, emoji) do update set active = p_force or not r.active, created_at = now()
  returning active into v;
  return v;
end $function$
;

CREATE OR REPLACE FUNCTION public.touch_updated()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at := clock_timestamp();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.untag_me(p_spot uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := public.my_guest(); p uuid;
begin
  update public.photo_spots set guest_id = null, by_hand = true, removed = (idx is null), updated_at = now()
  where id = p_spot and guest_id = me and me is not null
  returning photo_id into p;
  if p is not null then perform public.faces_sync(p, me); end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.update_profile(p_name text, p_instagram text, p_face boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update public.guests set name = trim(p_name), instagram = nullif(trim(p_instagram), ''), face_opt_in = coalesce(p_face, false)
  where user_id = auth.uid();
end $function$
;

CREATE OR REPLACE FUNCTION public.upload_quota_ok()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*) < 1000 and coalesce(sum((metadata->>'size')::bigint), 0) < 314572800
  from storage.objects where bucket_id = 'fotos' and owner_id = auth.uid()::text
$function$
;

CREATE OR REPLACE FUNCTION public.vapid_public()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select vapid_public from public.event_secret limit 1;
$function$
;

create or replace function public.photos_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.removed_at is not null and old.removed_at is null then
    new.caption := '';
    new.preview_url := null;
    new.thumb_url := null;
    new.links_until := null;
  end if;
  if (to_jsonb(new) - 'rescan' - 'faces_claimed_at' - 'updated_at')
     is distinct from (to_jsonb(old) - 'rescan' - 'faces_claimed_at' - 'updated_at') then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end $$;

CREATE TRIGGER live_mark AFTER INSERT OR DELETE OR UPDATE ON public.event_config FOR EACH STATEMENT EXECUTE FUNCTION live_mark();

CREATE TRIGGER guests_rostos_chamar AFTER INSERT OR UPDATE OF selfie_path, face_status ON public.guests FOR EACH ROW WHEN (((new.face_status = 'pending'::text) AND (new.selfie_path IS NOT NULL))) EXECUTE FUNCTION rostos_chamar_trg();

CREATE TRIGGER live_mark AFTER INSERT OR DELETE OR UPDATE ON public.missions FOR EACH STATEMENT EXECUTE FUNCTION live_mark();

CREATE TRIGGER live_mark AFTER INSERT OR DELETE OR UPDATE ON public.photo_faces FOR EACH STATEMENT EXECUTE FUNCTION live_mark();

CREATE TRIGGER photo_faces_touch BEFORE UPDATE ON public.photo_faces FOR EACH ROW EXECUTE FUNCTION touch_updated();

CREATE TRIGGER live_mark AFTER INSERT OR DELETE ON public.photos FOR EACH STATEMENT EXECUTE FUNCTION live_mark();

CREATE TRIGGER live_mark_update AFTER UPDATE ON public.photos REFERENCING OLD TABLE AS o NEW TABLE AS n FOR EACH STATEMENT EXECUTE FUNCTION live_mark_photos();

CREATE TRIGGER photos_mission_verdict BEFORE INSERT OR UPDATE OF faces_status, mission_id ON public.photos FOR EACH ROW EXECUTE FUNCTION mission_verdict();

CREATE TRIGGER photos_rostos_chamar AFTER INSERT OR UPDATE OF faces_status ON public.photos FOR EACH ROW WHEN (((new.faces_status = 'pending'::text) AND (new.kind = 'party'::text))) EXECUTE FUNCTION rostos_chamar_trg();

CREATE TRIGGER photos_store BEFORE INSERT ON public.photos FOR EACH ROW EXECUTE FUNCTION photo_store();

CREATE TRIGGER photos_touch BEFORE UPDATE ON public.photos FOR EACH ROW EXECUTE FUNCTION photos_touch();

CREATE TRIGGER live_mark AFTER INSERT OR DELETE OR UPDATE ON public.reactions FOR EACH STATEMENT EXECUTE FUNCTION live_mark();

alter table public.admin_attempts enable row level security;

alter table public.client_errors enable row level security;

alter table public.event_config enable row level security;

alter table public.event_secret enable row level security;

alter table public.face_extra enable row level security;

alter table public.face_refs enable row level security;

alter table public.face_vectors enable row level security;

alter table public.guest_codes enable row level security;

alter table public.guests enable row level security;

alter table public.join_attempts enable row level security;

alter table public.live_dirty enable row level security;

alter table public.missions enable row level security;

alter table public.photo_faces enable row level security;

alter table public.photo_spots enable row level security;

alter table public.photos enable row level security;

alter table public.push_log enable row level security;

alter table public.push_subs enable row level security;

alter table public.r2_links enable row level security;

alter table public.reactions enable row level security;

alter table public.rostos_dispatch enable row level security;

alter table public.rostos_vivo enable row level security;

alter table public.saude_estado enable row level security;

create policy "read config" on public.event_config as permissive for select to authenticated using (( SELECT is_guest() AS is_guest));

create policy "read guests" on public.guests as permissive for select to authenticated using (( SELECT is_guest() AS is_guest));

create policy "read missions" on public.missions as permissive for select to authenticated using (( SELECT is_guest() AS is_guest));

create policy "read who appears" on public.photo_faces as permissive for select to authenticated using ((( SELECT is_guest() AS is_guest) AND (score > (0)::double precision)));

create policy "read spots" on public.photo_spots as permissive for select to authenticated using ((( SELECT is_guest() AS is_guest) AND (NOT removed)));

create policy "read photos" on public.photos as permissive for select to authenticated using ((( SELECT is_guest() AS is_guest) AND ((NOT test) OR ( SELECT is_admin() AS is_admin))));

create policy "read reactions" on public.reactions as permissive for select to authenticated using (( SELECT is_guest() AS is_guest));

create policy "guests see the photos" on storage.objects as permissive for select to authenticated using (((bucket_id = 'fotos'::text) AND ( SELECT is_guest() AS is_guest) AND (((storage.foldername(name))[2] = (( SELECT my_guest() AS my_guest))::text) OR (((storage.foldername(name))[1] = ANY (ARRAY['party'::text, 'look'::text])) AND (EXISTS ( SELECT 1
   FROM photos p
  WHERE (((p.id)::text = "left"(storage.filename(objects.name), 36)) AND (p.removed_at IS NULL) AND ((NOT p.test) OR ( SELECT is_admin() AS is_admin)))))))));

create policy "guests delete their own selfie" on storage.objects for delete to authenticated
using (bucket_id = 'fotos' and (storage.foldername(name))[1] = 'selfie' and (storage.foldername(name))[2] = (select public.my_guest())::text);

create policy "guests hear the live nudges" on realtime.messages for select to authenticated
using ((select realtime.topic()) = 'live' and extension = 'broadcast' and (select public.is_guest()));

create policy "upload into a guest folder" on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'fotos'::text) AND ((storage.foldername(name))[1] = ANY (ARRAY['party'::text, 'look'::text, 'selfie'::text])) AND ((storage.foldername(name))[2] = (( SELECT my_guest() AS my_guest))::text) AND ( SELECT upload_quota_ok() AS upload_quota_ok)));

revoke all on public.admin_attempts from public, anon, authenticated;

revoke all on public.client_errors from public, anon, authenticated;

revoke all on public.event_config from public, anon, authenticated;

revoke all on public.event_secret from public, anon, authenticated;

revoke all on public.face_extra from public, anon, authenticated;

revoke all on public.face_refs from public, anon, authenticated;

revoke all on public.face_vectors from public, anon, authenticated;

revoke all on public.guest_codes from public, anon, authenticated;

revoke all on public.guests from public, anon, authenticated;

revoke all on public.join_attempts from public, anon, authenticated;

revoke all on public.live_dirty from public, anon, authenticated;

revoke all on public.missions from public, anon, authenticated;

revoke all on public.photo_faces from public, anon, authenticated;

revoke all on public.photo_spots from public, anon, authenticated;

revoke all on public.photos from public, anon, authenticated;

revoke all on public.push_log from public, anon, authenticated;

revoke all on public.push_subs from public, anon, authenticated;

revoke all on public.r2_links from public, anon, authenticated;

revoke all on public.reactions from public, anon, authenticated;

revoke all on public.rostos_dispatch from public, anon, authenticated;

revoke all on public.rostos_vivo from public, anon, authenticated;

revoke all on public.saude_estado from public, anon, authenticated;

grant delete on public.admin_attempts to anon;

grant insert on public.admin_attempts to anon;

grant references on public.admin_attempts to anon;

grant select on public.admin_attempts to anon;

grant trigger on public.admin_attempts to anon;

grant truncate on public.admin_attempts to anon;

grant update on public.admin_attempts to anon;

grant delete on public.admin_attempts to authenticated;

grant insert on public.admin_attempts to authenticated;

grant references on public.admin_attempts to authenticated;

grant select on public.admin_attempts to authenticated;

grant trigger on public.admin_attempts to authenticated;

grant truncate on public.admin_attempts to authenticated;

grant update on public.admin_attempts to authenticated;

grant references on public.event_config to anon;

grant trigger on public.event_config to anon;

grant references on public.event_config to authenticated;

grant select on public.event_config to authenticated;

grant trigger on public.event_config to authenticated;

grant references on public.guests to anon;

grant trigger on public.guests to anon;

grant references on public.guests to authenticated;

grant trigger on public.guests to authenticated;

grant references on public.missions to authenticated;

grant select on public.missions to authenticated;

grant trigger on public.missions to authenticated;

grant references on public.photo_faces to authenticated;

grant select on public.photo_faces to authenticated;

grant trigger on public.photo_faces to authenticated;

grant select on public.photo_spots to authenticated;

grant references on public.photos to anon;

grant trigger on public.photos to anon;

grant references on public.photos to authenticated;

grant select on public.photos to authenticated;

grant trigger on public.photos to authenticated;

grant references on public.reactions to anon;

grant trigger on public.reactions to anon;

grant references on public.reactions to authenticated;

grant select on public.reactions to authenticated;

grant trigger on public.reactions to authenticated;

grant delete on public.rostos_dispatch to anon;

grant insert on public.rostos_dispatch to anon;

grant references on public.rostos_dispatch to anon;

grant select on public.rostos_dispatch to anon;

grant trigger on public.rostos_dispatch to anon;

grant truncate on public.rostos_dispatch to anon;

grant update on public.rostos_dispatch to anon;

grant delete on public.rostos_dispatch to authenticated;

grant insert on public.rostos_dispatch to authenticated;

grant references on public.rostos_dispatch to authenticated;

grant select on public.rostos_dispatch to authenticated;

grant trigger on public.rostos_dispatch to authenticated;

grant truncate on public.rostos_dispatch to authenticated;

grant update on public.rostos_dispatch to authenticated;

revoke all on function public.admin_clear_photos() from public, anon, authenticated;

revoke all on function public.admin_face_secret() from public, anon, authenticated;

revoke all on function public.admin_face_stats() from public, anon, authenticated;

revoke all on function public.admin_mission(p_id uuid, p_title text, p_points integer, p_active boolean, p_sort integer, p_target text) from public, anon, authenticated;

revoke all on function public.admin_save_mission(p_id uuid, p_title text, p_points integer, p_active boolean, p_sort integer) from public, anon, authenticated;

revoke all on function public.admin_secrets() from public, anon, authenticated;

revoke all on function public.admin_set_code(p_code text) from public, anon, authenticated;

revoke all on function public.admin_stats() from public, anon, authenticated;

revoke all on function public.admin_update_event(p jsonb) from public, anon, authenticated;

revoke all on function public.admin_wipe_faces() from public, anon, authenticated;

revoke all on function public.claim_admin(p_code text) from public, anon, authenticated;

revoke all on function public.drop_push(p_endpoint text) from public, anon, authenticated;

revoke all on function public.drop_push(p_endpoint text, p_auth text) from public, anon, authenticated;

revoke all on function public.event_public(p_code text) from public, anon, authenticated;

revoke all on function public.face_claim(p_selfies integer, p_photos integer) from public, anon, authenticated;

revoke all on function public.face_match(p_photo uuid, p_threshold real) from public, anon, authenticated;

revoke all on function public.face_opt_out() from public, anon, authenticated;

revoke all on function public.face_promote_rescan(p_batch integer) from public, anon, authenticated;

revoke all on function public.face_rows(p_faces jsonb) from public, anon, authenticated;

revoke all on function public.face_save_faces(p_photo uuid, p_faces jsonb, p_threshold real) from public, anon, authenticated;

revoke all on function public.face_save_photo(p_photo uuid, p_embeddings jsonb) from public, anon, authenticated;

revoke all on function public.face_save_photo(p_photo uuid, p_embeddings jsonb, p_threshold real) from public, anon, authenticated;

revoke all on function public.face_save_selfie(p_guest uuid, p_embedding jsonb) from public, anon, authenticated;

revoke all on function public.face_work_waiting() from public, anon, authenticated;

revoke all on function public.faces_since(p_since timestamp with time zone) from public, anon, authenticated;

revoke all on function public.faces_sync(p_photo uuid, p_guest uuid) from public, anon, authenticated;

revoke all on function public.guest_for(p_token text) from public, anon, authenticated;

revoke all on function public.hide_photo(p_id uuid) from public, anon, authenticated;

revoke all on function public.is_admin() from public, anon, authenticated;

revoke all on function public.is_guest() from public, anon, authenticated;

revoke all on function public.join_party(p_token text, p_name text, p_instagram text, p_face boolean) from public, anon, authenticated;

revoke all on function public.live_flush() from public, anon, authenticated;

revoke all on function public.live_mark() from public, anon, authenticated;

revoke all on function public.live_mark_photos() from public, anon, authenticated;

revoke all on function public.log_client_error(p_note text, p_ua text) from public, anon, authenticated;

revoke all on function public.mission_verdict() from public, anon, authenticated;

revoke all on function public.my_face_progress() from public, anon, authenticated;

revoke all on function public.my_guest() from public, anon, authenticated;

revoke all on function public.my_return_code() from public, anon, authenticated;

revoke all on function public.name_matches(p_name text, p_target text) from public, anon, authenticated;

revoke all on function public.people_draw(p_me uuid, n integer, p_skip uuid[]) from public, anon, authenticated;

revoke all on function public.people_insert(p_me uuid, p_targets uuid[], p_sort integer) from public, anon, authenticated;

revoke all on function public.people_mission() from public, anon, authenticated;

revoke all on function public.people_points(n integer) from public, anon, authenticated;

revoke all on function public.people_swap(p_id uuid) from public, anon, authenticated;

revoke all on function public.people_title(p_names text[]) from public, anon, authenticated;

revoke all on function public.photo_store() from public, anon, authenticated;

revoke all on function public.ping() from public, anon, authenticated;

revoke all on function public.post_photo(p_token text, p_id uuid, p_kind text, p_caption text, p_frame text, p_tilt real, p_original text, p_preview text, p_bytes bigint) from public, anon, authenticated;

revoke all on function public.push_alive(p_endpoint text, p_auth text) from public, anon, authenticated;

revoke all on function public.react(p_photo uuid, p_emoji text, p_force boolean) from public, anon, authenticated;

revoke all on function public.remove_photo(p_token text, p_id uuid) from public, anon, authenticated;

revoke all on function public.rostos_allow(p_op text) from public, anon, authenticated;

revoke all on function public.rostos_chamar() from public, anon, authenticated;

revoke all on function public.rostos_chamar_trg() from public, anon, authenticated;

revoke all on function public.saude_medir() from public, anon, authenticated;

revoke all on function public.save_push(p_code text, p_endpoint text, p_p256dh text, p_auth text) from public, anon, authenticated;

revoke all on function public.send_photo(p_id uuid, p_kind text, p_caption text, p_frame text, p_tilt real, p_original text, p_preview text, p_bytes bigint, p_mission uuid) from public, anon, authenticated;

revoke all on function public.set_selfie(p_path text) from public, anon, authenticated;

revoke all on function public.share_photo(p_id uuid, p_kind text, p_caption text, p_frame text, p_tilt real, p_original text, p_preview text, p_bytes bigint) from public, anon, authenticated;

revoke all on function public.tag_spot(p_photo uuid, p_spot uuid, p_x real, p_y real, p_guest uuid) from public, anon, authenticated;

revoke all on function public.target_has_face(p_target text, p_author uuid) from public, anon, authenticated;

revoke all on function public.toggle_reaction(p_token text, p_photo uuid, p_emoji text, p_force boolean) from public, anon, authenticated;

revoke all on function public.touch_updated() from public, anon, authenticated;

revoke all on function public.untag_me(p_spot uuid) from public, anon, authenticated;

revoke all on function public.update_profile(p_name text, p_instagram text, p_face boolean) from public, anon, authenticated;

revoke all on function public.upload_quota_ok() from public, anon, authenticated;

revoke all on function public.vapid_public() from public, anon, authenticated;

grant execute on function public.admin_clear_photos() to authenticated;

grant execute on function public.admin_face_secret() to authenticated;

grant execute on function public.admin_face_stats() to authenticated;

grant execute on function public.admin_mission(p_id uuid, p_title text, p_points integer, p_active boolean, p_sort integer, p_target text) to authenticated;

grant execute on function public.admin_secrets() to authenticated;

grant execute on function public.admin_set_code(p_code text) to authenticated;

grant execute on function public.admin_stats() to authenticated;

grant execute on function public.admin_update_event(p jsonb) to authenticated;

grant execute on function public.admin_wipe_faces() to authenticated;

grant execute on function public.claim_admin(p_code text) to authenticated;

grant execute on function public.drop_push(p_endpoint text, p_auth text) to anon;

grant execute on function public.drop_push(p_endpoint text, p_auth text) to authenticated;

grant execute on function public.event_public(p_code text) to anon;

grant execute on function public.event_public(p_code text) to authenticated;

grant execute on function public.face_opt_out() to authenticated;

grant execute on function public.faces_since(p_since timestamp with time zone) to authenticated;

grant execute on function public.hide_photo(p_id uuid) to authenticated;

grant execute on function public.is_admin() to authenticated;

grant execute on function public.is_guest() to authenticated;

grant execute on function public.log_client_error(p_note text, p_ua text) to authenticated;

grant execute on function public.mission_verdict() to anon;

grant execute on function public.mission_verdict() to authenticated;

grant execute on function public.my_face_progress() to authenticated;

grant execute on function public.my_guest() to authenticated;

grant execute on function public.my_return_code() to authenticated;

grant execute on function public.people_mission() to authenticated;

grant execute on function public.people_points(n integer) to anon;

grant execute on function public.people_points(n integer) to authenticated;

grant execute on function public.people_swap(p_id uuid) to authenticated;

grant execute on function public.people_title(p_names text[]) to anon;

grant execute on function public.people_title(p_names text[]) to authenticated;

grant execute on function public.photo_store() to anon;

grant execute on function public.photo_store() to authenticated;

grant execute on function public.ping() to anon;

grant execute on function public.ping() to authenticated;

grant execute on function public.push_alive(p_endpoint text, p_auth text) to anon;

grant execute on function public.push_alive(p_endpoint text, p_auth text) to authenticated;

grant execute on function public.react(p_photo uuid, p_emoji text, p_force boolean) to authenticated;

grant execute on function public.rostos_chamar_trg() to anon;

grant execute on function public.rostos_chamar_trg() to authenticated;

grant execute on function public.save_push(p_code text, p_endpoint text, p_p256dh text, p_auth text) to authenticated;

grant execute on function public.save_push(p_code text, p_endpoint text, p_p256dh text, p_auth text) to anon;

grant execute on function public.send_photo(p_id uuid, p_kind text, p_caption text, p_frame text, p_tilt real, p_original text, p_preview text, p_bytes bigint, p_mission uuid) to authenticated;

grant execute on function public.set_selfie(p_path text) to authenticated;

grant execute on function public.tag_spot(p_photo uuid, p_spot uuid, p_x real, p_y real, p_guest uuid) to authenticated;

grant execute on function public.touch_updated() to anon;

grant execute on function public.touch_updated() to authenticated;

grant execute on function public.untag_me(p_spot uuid) to authenticated;

grant execute on function public.update_profile(p_name text, p_instagram text, p_face boolean) to authenticated;

grant execute on function public.upload_quota_ok() to authenticated;

alter publication supabase_realtime add table public.event_config;

alter publication supabase_realtime add table public.guests;

alter publication supabase_realtime add table public.missions;

alter publication supabase_realtime add table public.photo_faces;

alter publication supabase_realtime add table public.photo_spots;

alter publication supabase_realtime add table public.photos;

alter publication supabase_realtime add table public.reactions;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('fotos', 'fotos', false, 26214400, '{image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif}') on conflict (id) do nothing;


create table if not exists public.join_keys (
  key uuid primary key,
  guest_id uuid references public.guests(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.join_keys enable row level security;
revoke all on public.join_keys from public, anon, authenticated;

create or replace function public.set_reaction(p_photo uuid, p_emoji text, p_active boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare g uuid := public.my_guest();
begin
  if g is null then raise exception 'convidado não encontrado'; end if;
  insert into public.reactions as r (photo_id, guest_id, emoji, active) values (p_photo, g, p_emoji, p_active)
  on conflict (photo_id, guest_id, emoji) do update set active = excluded.active, created_at = now()
  where r.active is distinct from excluded.active;
  return p_active;
end $$;
revoke all on function public.set_reaction(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.set_reaction(uuid, text, boolean) to authenticated;

-- Fourth core review: less work per nudge, and nothing granted that nobody uses.

-- Missions say when they last changed, so phones read only those after a nudge, not every mission of the
-- party again (each guest's missions with people made every phone read them all, over and over).
alter table public.missions add column if not exists updated_at timestamptz not null default now();
create index if not exists missions_updated_at on public.missions (updated_at);
create or replace trigger missions_touch before update on public.missions
for each row execute function public.touch_updated();

-- Reminders before the party (no guest yet) share one cap, so a flood of made-up sign-ups can no longer
-- take every place; a guest's own phones are kept to the newest 5 instead, and never hit that cap.
create or replace function public.save_push(p_code text, p_endpoint text, p_p256dh text, p_auth text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare g uuid := public.my_guest();
begin
  if p_endpoint !~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]*\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]*\.notify\.windows\.com|[a-z0-9.-]*\.push\.samsungosp\.com)/'
     or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'inscrição inválida';
  end if;
  if g is null then
    if (select count(*) from public.push_subs where removed_at is null and guest_id is null) >= 3000
       and not exists (select 1 from public.push_subs where endpoint = p_endpoint) then
      raise exception 'limite';
    end if;
  else
    update public.push_subs set removed_at = now()
    where endpoint in (
      select endpoint from public.push_subs
      where guest_id = g and removed_at is null and endpoint <> p_endpoint
      order by coalesce(last_ok, created_at) desc offset 4
    );
  end if;
  insert into public.push_subs (endpoint, p256dh, auth, guest_id) values (p_endpoint, p_p256dh, p_auth, g)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, removed_at = null,
    guest_id = coalesce(excluded.guest_id, public.push_subs.guest_id);
  return true;
end $$;
revoke all on function public.save_push(text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_push(text, text, text, text) to anon, authenticated;

-- Grants nobody uses: the phones only read these tables (row rules decide what), never change them.
revoke all on public.admin_attempts, public.rostos_dispatch from anon, authenticated;
revoke references, trigger, truncate on public.event_config, public.guests, public.missions, public.photo_faces,
  public.photos, public.reactions from anon, authenticated;
revoke execute on function public.people_points(integer), public.people_title(text[]) from public, anon;

-- Phones hear about changes by the "live" nudge only: the tables no longer stream every change to the
-- realtime server for nobody.
alter publication supabase_realtime drop table public.event_config, public.guests, public.missions,
  public.photo_faces, public.photo_spots, public.photos, public.reactions;

-- Security Advisor clean-up: the two helpers that build missions with people get a fixed search_path, and
-- trigger functions are no longer offered to phones as callable endpoints (they only ever run as triggers,
-- which does not need that grant).
alter function public.people_points(integer) set search_path = '';
alter function public.people_title(text[]) set search_path = '';
revoke execute on function public.mission_verdict(), public.photo_store(), public.rostos_chamar_trg()
  from public, anon, authenticated;

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
