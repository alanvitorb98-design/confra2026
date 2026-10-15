-- Better recognition: besides the selfie, each guest gets extra references taken from party photos (other
-- angles, light and the look of the day). A face the server matched with high confidence becomes one, and so
-- does a detected face that whoever took the photo tagged by hand, if it still looks like that guest's selfie
-- (so a wrong tag can't teach the server a stranger). Only guests who opted in get references, and they are
-- biometric data: removed with face_opt_out and admin_wipe_faces like the selfie.
create table if not exists public.face_extra (
  guest_id uuid not null references public.guests(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  -- null once erased (opt-out, wipe, a tag taken off)
  embedding extensions.vector(512),
  score real not null,
  by_hand boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (guest_id, photo_id)
);
alter table public.face_extra enable row level security;
revoke all on public.face_extra from anon, authenticated;
alter table public.face_extra alter column embedding drop not null;

-- the face server's answer as rows: face number, signature, box
create or replace function public.face_rows(p_faces jsonb)
returns table (idx int, v extensions.vector(512), b jsonb) language sql immutable set search_path to '' as $$
  select (t.o - 1)::int, ((t.e -> 'e')::text)::extensions.vector(512), t.e -> 'b'
  from jsonb_array_elements(coalesce(p_faces, '[]'::jsonb)) with ordinality t(e, o)
$$;

create or replace function public.face_save_faces(p_photo uuid, p_faces jsonb, p_threshold real default 0.42)
returns integer language plpgsql security definer set search_path to '' as $$
declare n int;
  learn_at constant real := 0.6;   -- a match this sure becomes a reference
  hand_min constant real := 0.3;   -- every reference must look at least this much like the guest's selfie
  most constant int := 12;         -- references from photos per guest
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
        -- already tagged by hand somewhere else in this photo: leave them there
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
    -- an older face server sends no boxes: keep its answer as before
    insert into public.photo_faces (photo_id, guest_id, score)
    select p_photo, guest_id, score from ranked where hit and jsonb_typeof(b) is distinct from 'array'
    on conflict (photo_id, guest_id) do update set score = greatest(public.photo_faces.score, excluded.score)
      where public.photo_faces.by_hand is null
    returning 1
  )
  select count(*) into n from ranked where hit;
  -- who appears, from the spots the face server holds (a spot set by hand is synced by tag_spot)
  insert into public.photo_faces (photo_id, guest_id, score, by_hand)
  select p_photo, s.guest_id, coalesce(s.score, p_threshold), null from public.photo_spots s
  where s.photo_id = p_photo and s.guest_id is not null and not s.by_hand and not s.removed
  on conflict (photo_id, guest_id) do update set score = excluded.score, by_hand = null
    where public.photo_faces.by_hand is distinct from 'add';

  -- learn: sure matches and faces tagged by hand that look like the guest become references
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
  -- always anchored to the selfie, so references can't drift to someone else photo by photo
  cross join lateral (
    select (1 - (r.embedding operator(extensions.<=>) f.v))::real as score
    from public.face_refs r where r.guest_id = s.guest_id and r.embedding is not null
  ) me
  where s.photo_id = p_photo and not s.removed and s.idx is not null
    and me.score >= hand_min and (s.by_hand or k.score >= learn_at)
    -- the same as one it already has teaches nothing
    and k.score < 0.95
    and (select count(*) from public.face_extra x where x.guest_id = s.guest_id and x.embedding is not null) < most
  order by s.guest_id, k.score desc
  on conflict (guest_id, photo_id) do update set embedding = excluded.embedding, score = excluded.score, by_hand = excluded.by_hand, created_at = now();

  update public.photos set faces_status = 'done' where id = p_photo;
  perform public.face_promote_rescan();
  return n;
end $$;

-- photo_faces follows the spots for one guest after a change by hand; a tag taken off also drops what the
-- server learned about that guest from this photo
create or replace function public.faces_sync(p_photo uuid, p_guest uuid)
returns void language plpgsql security definer set search_path to '' as $$
begin
  if p_guest is null then return; end if;
  if exists (select 1 from public.photo_spots where photo_id = p_photo and guest_id = p_guest and not removed) then
    insert into public.photo_faces (photo_id, guest_id, score, by_hand) values (p_photo, p_guest, 1, 'add')
    on conflict (photo_id, guest_id) do update set score = 1, by_hand = 'add' where public.photo_faces.score <= 0;
    if exists (select 1 from public.photo_spots where photo_id = p_photo and guest_id = p_guest and by_hand and not removed) then
      -- just set by hand: what the server learned about them from this photo may be from another face
      update public.face_extra set embedding = null where photo_id = p_photo and guest_id = p_guest and embedding is not null;
      -- a detected face tagged by hand: read the photo again (after new photos) so the server learns this face
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
  -- the mission check reads photo_faces: run it again
  update public.photos set faces_status = faces_status where id = p_photo and mission_id is not null;
end $$;

create or replace function public.face_opt_out()
returns void language plpgsql security definer set search_path to '' as $$
declare g uuid;
begin
  g := public.my_guest();
  update public.guests set face_opt_in = false, face_status = 'none', selfie_path = null where id = g;
  update public.face_refs set embedding = null, updated_at = now() where guest_id = g;
  update public.face_extra set embedding = null where guest_id = g and embedding is not null;
  update public.photo_faces set score = -1 where guest_id = g and by_hand is null;
  update public.photo_spots set guest_id = null where guest_id = g and not by_hand;
end $$;

create or replace function public.admin_wipe_faces()
returns void language plpgsql security definer set search_path to '' as $$
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  update public.face_refs set embedding = null, updated_at = now() where embedding is not null;
  update public.face_extra set embedding = null where embedding is not null;
  update public.photo_faces set score = -1 where score > 0 and by_hand is null;
  update public.photo_spots set guest_id = null where guest_id is not null and not by_hand;
  update public.guests set face_status = 'none', selfie_path = null where face_status <> 'none' or selfie_path is not null;
  update public.photos set faces_status = 'skip' where faces_status = 'pending';
end $$;

revoke all on function public.face_rows(jsonb) from public, anon, authenticated;
revoke all on function public.face_save_faces(uuid, jsonb, real) from public, anon, authenticated;
revoke all on function public.faces_sync(uuid, uuid) from public, anon, authenticated;
