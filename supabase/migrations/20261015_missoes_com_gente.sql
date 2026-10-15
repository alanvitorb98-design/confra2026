-- Missions with people: once enough guests are in, each guest gets missions generated just for them,
-- asking for a photo with 1, 2, 3... other guests drawn at random among those who opted in to face
-- recognition (so the photo can be checked). One open at a time; the next one asks for one more person
-- every two missions done, up to gen_max_people.

alter table public.missions add column if not exists owner uuid references public.guests(id) on delete cascade;
alter table public.missions add column if not exists targets uuid[];
create index if not exists missions_owner on public.missions(owner) where owner is not null;

alter table public.event_config add column if not exists gen_missions boolean not null default true;
alter table public.event_config add column if not exists gen_min_guests int not null default 15;
alter table public.event_config add column if not exists gen_max_people int not null default 4;
alter table public.event_config add column if not exists gen_swaps int not null default 3;

-- the verdict trigger learns the new kind: every target must be found in the photo, taken by the owner
create or replace function public.mission_verdict() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text; tg uuid[]; own uuid;
begin
  if new.mission_id is null then new.mission_ok := null; return new; end if;
  select nullif(trim(target), ''), targets, owner into t, tg, own from public.missions where id = new.mission_id;
  if tg is not null then
    if own is distinct from new.guest_id then new.mission_ok := false;
    elsif new.faces_status = 'done' then
      new.mission_ok := not exists (
        select 1 from unnest(tg) x(id)
        where not exists (select 1 from public.photo_faces pf where pf.photo_id = new.id and pf.guest_id = x.id and pf.score > 0)
      );
    elsif new.faces_status = 'failed' then new.mission_ok := false;
    else new.mission_ok := null; -- waiting for the face worker
    end if;
    return new;
  end if;
  if t is null then new.mission_ok := true; return new; end if;
  if new.faces_status = 'done' then
    new.mission_ok := exists (
      select 1 from public.photo_faces pf join public.guests g on g.id = pf.guest_id
      where pf.photo_id = new.id and pf.score > 0 and pf.guest_id <> new.guest_id and public.name_matches(g.name, t)
    );
  elsif new.faces_status = 'failed' or not public.target_has_face(t, new.guest_id) then
    new.mission_ok := false;
  else
    new.mission_ok := null; -- waiting for the face worker
  end if;
  return new;
end $$;

-- "Foto com Ana", "Foto com Ana e Beto", "Foto com Ana, Beto e Caio"
create or replace function public.people_title(p_names text[]) returns text
language sql immutable as $$
  select 'Foto com ' || case
    when cardinality(p_names) = 1 then p_names[1]
    else array_to_string(p_names[1:cardinality(p_names) - 1], ', ') || ' e ' || p_names[cardinality(p_names)]
  end
$$;

-- points grow faster than the number of people, since big groups are harder to gather
create or replace function public.people_points(n int) returns int
language sql immutable as $$ select (array[10, 25, 45, 70, 100, 135])[least(greatest(n, 1), 6)] $$;

-- Draws n guests for p_me: opted in, with a face on file, not p_me, not in p_skip; people targeted
-- the fewest times come first so everyone gets looked for, ties broken at random.
create or replace function public.people_draw(p_me uuid, n int, p_skip uuid[]) returns uuid[]
language sql volatile security definer set search_path = public as $$
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
$$;

create or replace function public.people_insert(p_me uuid, p_targets uuid[], p_sort int) returns uuid
language plpgsql security definer set search_path = public as $$
declare names text[]; mid uuid;
begin
  select array_agg(g.name order by x.ord) into names
  from unnest(p_targets) with ordinality x(id, ord) join public.guests g on g.id = x.id;
  insert into public.missions (title, points, active, sort, owner, targets)
  values (public.people_title(names), public.people_points(cardinality(p_targets)), true, p_sort, p_me, p_targets)
  returning id into mid;
  return mid;
end $$;

-- Guest's current mission with people, creating the next one when none is open.
-- Returns {id} or {id: null, need: guests still missing} or {id: null, off: true}.
create or replace function public.people_mission() returns jsonb
language plpgsql security definer set search_path = public as $$
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
end $$;

-- Someone can't be found: draw other people for the same mission size, a few times per guest.
create or replace function public.people_swap(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
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
end $$;

revoke all on function public.people_draw(uuid, int, uuid[]) from public, anon, authenticated;
revoke all on function public.people_insert(uuid, uuid[], int) from public, anon, authenticated;
revoke all on function public.people_mission() from public, anon;
revoke all on function public.people_swap(uuid) from public, anon;
grant execute on function public.people_mission() to authenticated;
grant execute on function public.people_swap(uuid) to authenticated;
