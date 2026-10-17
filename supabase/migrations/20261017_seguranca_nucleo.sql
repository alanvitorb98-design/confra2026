-- Third core review: what one guest could see or do to the others, and work the database did for nothing.

-- The live nudge goes out on a private channel: only signed-in guests hear it, and since no policy lets a
-- phone write to realtime.messages, only the database can send one (a fake nudge loop made every phone
-- read everything again, over and over).
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

create policy "guests hear the live nudges" on realtime.messages for select to authenticated
using ((select realtime.topic()) = 'live' and extension = 'broadcast' and (select public.is_guest()));

-- A removed photo keeps its row (phones learn it is gone from it) but nothing anyone could still open:
-- no caption and no links to its copies.
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

update public.photos set caption = '', preview_url = null, thumb_url = null, links_until = null
where removed_at is not null and (caption <> '' or preview_url is not null or thumb_url is not null or links_until is not null);

-- Phones hear about photos only when something they show changed (updated_at moved): the face server
-- taking photos off the queue, even none, no longer nudges every phone.
create or replace function public.live_mark_photos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from n join o using (id) where n.updated_at is distinct from o.updated_at) then
    update public.live_dirty set changed_at = clock_timestamp() where tbl = 'photos';
  end if;
  return null;
end $$;
revoke all on function public.live_mark_photos() from public, anon, authenticated;

create or replace trigger live_mark after insert or delete on public.photos
for each statement execute function public.live_mark();
create or replace trigger live_mark_update after update on public.photos
referencing old table as o new table as n
for each statement execute function public.live_mark_photos();

-- The face server's heartbeat lives in rostos_vivo (face_claim writes it): writing it into event_config
-- made every phone read the event again every few seconds.
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

-- Tags taken off (by hand, or a guest turning recognition off) are told to phones for a day, long enough
-- for every phone at the party to drop them, then no longer: they said who had been found where.
create or replace function public.faces_since(p_since timestamptz)
returns table(photo_id uuid, guest_id uuid, shown boolean, at timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.photo_id, f.guest_id, f.score > 0, f.updated_at
  from public.photo_faces f
  where (select public.is_guest()) and f.updated_at > p_since
    and (f.score > 0 or f.updated_at > now() - interval '1 day')
$$;

-- A selfie read after its guest turned recognition off is thrown away, not saved.
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

-- A guest turning recognition off deletes their own selfie photo right away (it was left behind when the
-- face server had not read it yet).
create policy "guests delete their own selfie" on storage.objects for delete to authenticated
using (bucket_id = 'fotos' and (storage.foldername(name))[1] = 'selfie' and (storage.foldername(name))[2] = (select public.my_guest())::text);
