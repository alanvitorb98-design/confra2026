-- Fix: a tag taken off by hand before the face server ran kept the person out of "Aparece" and the ranking
-- even after the server found their face. "Who appears" now follows the spots: the face server's answer
-- counts whenever its spot holds that guest (a spot changed by hand still wins), and a guest already
-- tagged by hand on another spot of the photo is never assigned again by the server.
alter table public.photo_spots add column if not exists score real;

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
  update public.photos set faces_status = 'done' where id = p_photo;
  perform public.face_promote_rescan();
  return n;
end $$;

revoke all on function public.face_save_faces(uuid, jsonb, real) from public, anon, authenticated;
