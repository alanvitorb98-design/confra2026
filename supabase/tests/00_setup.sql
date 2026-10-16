-- Fixtures for the database tests: runs once after supabase/schema.sql on a fresh local Supabase.
-- Starting a face server calls GitHub through the internet; in tests it only records that it was asked.
create table if not exists public.test_calls (what text, at timestamptz default now());
create or replace function public.rostos_chamar() returns text language plpgsql security definer set search_path = '' as $$
begin
  if not public.face_work_waiting() then return 'vazio'; end if;
  insert into public.test_calls (what) values ('rostos');
  return 'chamado';
end $$;

-- the party is happening now, so the camera is open
insert into public.event_config (id, look_opens, look_closes, party_starts, party_ends, app_opens)
values (true, now() - interval '3 hours', now() - interval '2 hours', now() - interval '1 hour', now() + interval '5 hours', now() - interval '1 day')
on conflict (id) do update set party_starts = excluded.party_starts, party_ends = excluded.party_ends;
insert into public.event_secret (id, code) values (true, 'TESTE1') on conflict (id) do nothing;

-- three guests (one organizer), each with a login
insert into auth.users (id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'ana@teste'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'bia@teste'),
  ('00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'org@teste');
insert into public.guests (id, name, user_id, is_admin) values
  ('10000000-0000-0000-0000-00000000000a', 'Ana', '00000000-0000-0000-0000-00000000000a', false),
  ('10000000-0000-0000-0000-00000000000b', 'Bia', '00000000-0000-0000-0000-00000000000b', false),
  ('10000000-0000-0000-0000-00000000000c', 'Org', '00000000-0000-0000-0000-00000000000c', true);

-- act as a guest inside the current transaction
create or replace function public.test_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on function public.test_as(uuid) to authenticated;
