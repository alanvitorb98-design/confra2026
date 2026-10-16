-- Live feed that holds hundreds of phones: instead of one message per change per phone (Postgres Changes,
-- which past ~50 people dropped most updates in the load test), the database marks which tables changed and
-- a job every 3 seconds sends one tiny nudge naming them. Each phone then asks only for rows changed since
-- the last look (photos.updated_at, reactions.created_at, faces_since).

alter table public.photos add column if not exists updated_at timestamptz not null default now();
alter table public.photo_faces add column if not exists updated_at timestamptz not null default now();
create index if not exists photos_updated on public.photos (updated_at);
create index if not exists photo_faces_updated on public.photo_faces (updated_at);
create index if not exists reactions_created on public.reactions (created_at);

create or replace function public.touch_updated()
returns trigger language plpgsql set search_path to '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
create or replace trigger photos_touch before update on public.photos for each row execute function public.touch_updated();
create or replace trigger photo_faces_touch before update on public.photo_faces for each row execute function public.touch_updated();

-- which tables changed, and up to when a nudge already went out for them
create table if not exists public.live_dirty (
  tbl text primary key,
  changed_at timestamptz not null default '-infinity',
  sent_at timestamptz not null default '-infinity'
);
alter table public.live_dirty enable row level security;
revoke all on public.live_dirty from anon, authenticated;
insert into public.live_dirty (tbl) values ('photos'), ('reactions'), ('photo_faces'), ('missions'), ('event_config')
on conflict (tbl) do nothing;

create or replace function public.live_mark()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
  update public.live_dirty set changed_at = clock_timestamp() where tbl = tg_table_name;
  return null;
end $$;
create or replace trigger live_mark after insert or update or delete on public.photos for each statement execute function public.live_mark();
create or replace trigger live_mark after insert or update or delete on public.reactions for each statement execute function public.live_mark();
create or replace trigger live_mark after insert or update or delete on public.photo_faces for each statement execute function public.live_mark();
create or replace trigger live_mark after insert or update or delete on public.missions for each statement execute function public.live_mark();
create or replace trigger live_mark after insert or update or delete on public.event_config for each statement execute function public.live_mark();

-- one nudge for everything that changed since the last one. sent_at takes the change time it saw (not the
-- clock), so a change still being written right now is newer than it and goes in the next nudge
create or replace function public.live_flush()
returns void language plpgsql security definer set search_path to '' as $$
declare r record; t text[] := '{}';
begin
  if not pg_try_advisory_xact_lock(4207) then return; end if;
  for r in select tbl, changed_at from public.live_dirty where changed_at > sent_at loop
    t := t || r.tbl;
    update public.live_dirty set sent_at = r.changed_at where tbl = r.tbl;
  end loop;
  if cardinality(t) > 0 then
    perform realtime.send(jsonb_build_object('t', t), 'tick', 'live', false);
  end if;
end $$;
revoke all on function public.live_flush() from public, anon, authenticated;
revoke all on function public.live_mark() from public, anon, authenticated;

select cron.schedule('ao-vivo', '3 seconds', 'select public.live_flush()');

-- who appears, changed since a moment: also the ones taken off (the table itself only shows score > 0)
create or replace function public.faces_since(p_since timestamptz)
returns table (photo_id uuid, guest_id uuid, shown boolean, at timestamptz)
language sql stable security definer set search_path to '' as $$
  select f.photo_id, f.guest_id, f.score > 0, f.updated_at
  from public.photo_faces f
  where (select public.is_guest()) and f.updated_at > p_since
$$;
revoke all on function public.faces_since(timestamptz) from public, anon;
grant execute on function public.faces_since(timestamptz) to authenticated;
