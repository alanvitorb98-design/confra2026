-- Marcação nas fotos: where each face is in a photo (from the face server) and who it is. The face server
-- fills the spots and its guess; whoever took the photo (or an organizer) can say who a face is, fix a wrong
-- guess, or tap anywhere to tag someone the server missed. A tagged guest can take their own tag off.
-- Tags made by hand show in "Aparece" and in the ranking, but never complete a mission (only the face
-- server does), so nobody gets points by tagging a stranger.

create table if not exists public.photo_spots (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos(id) on delete cascade,
  -- face number from the face server; null for a spot tapped by hand
  idx int,
  -- box in fractions of the photo (w = h = 0 for a tapped point)
  x real not null,
  y real not null,
  w real not null default 0,
  h real not null default 0,
  guest_id uuid references public.guests(id) on delete set null,
  -- who it is was set by a person: the face server no longer changes it
  by_hand boolean not null default false,
  removed boolean not null default false,
  tagged_by uuid references public.guests(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (photo_id, idx)
);
create index if not exists photo_spots_photo on public.photo_spots (photo_id);
alter table public.photo_spots enable row level security;
create policy "read spots" on public.photo_spots for select to authenticated using ((select public.is_guest()) and not removed);
revoke all on public.photo_spots from anon, authenticated;
grant select on public.photo_spots to authenticated;
alter publication supabase_realtime add table public.photo_spots;

-- 'add': tagged by hand; 'remove': taken off by hand (the face server must not bring it back)
alter table public.photo_faces add column if not exists by_hand text check (by_hand in ('add', 'remove'));

-- photo_faces follows the spots for one guest after a change by hand
create or replace function public.faces_sync(p_photo uuid, p_guest uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if p_guest is null then return; end if;
  if exists (select 1 from public.photo_spots where photo_id = p_photo and guest_id = p_guest and not removed) then
    insert into public.photo_faces (photo_id, guest_id, score, by_hand) values (p_photo, p_guest, 1, 'add')
    on conflict (photo_id, guest_id) do update set score = 1, by_hand = 'add' where public.photo_faces.score <= 0;
  else
    update public.photo_faces set score = -1, by_hand = 'remove' where photo_id = p_photo and guest_id = p_guest and score > 0;
  end if;
  -- the mission check reads photo_faces: run it again
  update public.photos set faces_status = faces_status where id = p_photo and mission_id is not null;
end $$;

-- the face server's answer for a photo: [{e: 512 numbers, b: [x, y, w, h]}, ...]
create or replace function public.face_save_faces(p_photo uuid, p_faces jsonb, p_threshold real default 0.42)
returns integer language plpgsql security definer set search_path to '' as $$
declare n int;
begin
  with f as (
    select (t.o - 1)::int as idx, ((t.e -> 'e')::text)::extensions.vector(512) as v, t.e -> 'b' as b
    from jsonb_array_elements(coalesce(p_faces, '[]'::jsonb)) with ordinality t(e, o)
  ), best as (
    select f.idx, f.b, m.guest_id, m.score
    from f left join lateral (
      select r.guest_id, (1 - (r.embedding operator(extensions.<=>) f.v))::real as score
      from public.face_refs r join public.guests g on g.id = r.guest_id
      where r.embedding is not null and g.face_opt_in
      order by r.embedding operator(extensions.<=>) f.v
      limit 1
    ) m on true
  ), ranked as (
    -- each guest goes to the face that looks most like them
    select *, coalesce(score >= p_threshold, false) and row_number() over (partition by guest_id order by score desc) = 1 as hit
    from best
  ), spots as (
    insert into public.photo_spots (photo_id, idx, x, y, w, h, guest_id)
    select p_photo, idx, (b ->> 0)::real, (b ->> 1)::real, (b ->> 2)::real, (b ->> 3)::real, case when hit then guest_id end
    from ranked where jsonb_typeof(b) = 'array' and jsonb_array_length(b) = 4
    on conflict (photo_id, idx) do update set
      x = excluded.x, y = excluded.y, w = excluded.w, h = excluded.h, updated_at = now(),
      guest_id = case when public.photo_spots.by_hand then public.photo_spots.guest_id else excluded.guest_id end
    returning 1
  )
  insert into public.photo_faces (photo_id, guest_id, score)
  select p_photo, guest_id, score from ranked where hit
  on conflict (photo_id, guest_id) do update set score = greatest(public.photo_faces.score, excluded.score)
    where public.photo_faces.by_hand is null;
  get diagnostics n = row_count;
  update public.photos set faces_status = 'done' where id = p_photo;
  perform public.face_promote_rescan();
  return n;
end $$;

-- the older entry point keeps its answers but no longer undoes a change made by hand
create or replace function public.face_save_photo(p_photo uuid, p_embeddings jsonb, p_threshold real default 0.42)
returns integer language plpgsql security definer set search_path to '' as $$
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
end $$;

-- whoever took the photo (or an organizer) says who a face is. p_spot null: a new spot at (p_x, p_y).
-- p_guest null: nobody / take the tag off.
create or replace function public.tag_spot(p_photo uuid, p_spot uuid, p_x real, p_y real, p_guest uuid)
returns uuid language plpgsql security definer set search_path to '' as $$
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
  -- someone appears once per photo: tagged here, they leave any other spot
  if p_guest is not null then
    update public.photo_spots set guest_id = null, by_hand = true, removed = (idx is null), updated_at = now()
    where photo_id = p_photo and guest_id = p_guest and id <> p_spot;
  end if;
  perform public.faces_sync(p_photo, old);
  perform public.faces_sync(p_photo, p_guest);
  return p_spot;
end $$;

-- a tagged guest takes their own tag off
create or replace function public.untag_me(p_spot uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare me uuid := public.my_guest(); p uuid;
begin
  update public.photo_spots set guest_id = null, by_hand = true, removed = (idx is null), updated_at = now()
  where id = p_spot and guest_id = me and me is not null
  returning photo_id into p;
  if p is not null then perform public.faces_sync(p, me); end if;
end $$;

-- leaving face recognition also clears the face server's guesses about you (tags by hand stay: they are not biometric)
create or replace function public.face_opt_out()
returns void language plpgsql security definer set search_path to '' as $$
declare g uuid;
begin
  g := public.my_guest();
  update public.guests set face_opt_in = false, face_status = 'none', selfie_path = null where id = g;
  update public.face_refs set embedding = null, updated_at = now() where guest_id = g;
  update public.photo_faces set score = -1 where guest_id = g and by_hand is null;
  update public.photo_spots set guest_id = null where guest_id = g and not by_hand;
end $$;

create or replace function public.admin_wipe_faces()
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  update public.face_refs set embedding = null, updated_at = now() where embedding is not null;
  update public.photo_faces set score = -1 where score > 0 and by_hand is null;
  update public.photo_spots set guest_id = null where guest_id is not null and not by_hand;
  update public.guests set face_status = 'none', selfie_path = null where face_status <> 'none' or selfie_path is not null;
  update public.photos set faces_status = 'skip' where faces_status = 'pending';
end $$;

-- missions count only what the face server found
create or replace function public.mission_verdict()
returns trigger language plpgsql security definer set search_path to 'public' as $$
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
end $$;

revoke all on function public.faces_sync(uuid, uuid) from public, anon, authenticated;
revoke all on function public.face_save_faces(uuid, jsonb, real) from public, anon, authenticated;
revoke all on function public.face_save_photo(uuid, jsonb, real) from public, anon, authenticated;
revoke all on function public.tag_spot(uuid, uuid, real, real, uuid) from public, anon;
revoke all on function public.untag_me(uuid) from public, anon;
grant execute on function public.tag_spot(uuid, uuid, real, real, uuid) to authenticated;
grant execute on function public.untag_me(uuid) to authenticated;
