-- Missions with people: each guest gets one at a time, only with people who agreed to face recognition,
-- not before the party has enough guests, and can swap it a limited number of times.
begin;
update public.event_config set gen_missions = true, gen_max_people = 4, gen_min_guests = 5, gen_swaps = 1;
update public.guests set face_opt_in = true where name = 'Bia';
insert into public.face_refs (guest_id, embedding)
values ('10000000-0000-0000-0000-00000000000b', array_fill(0.1::real, array[512])::vector);

-- 3 guests and 5 needed: no mission yet, and the app is told how many are missing
select public.test_as('00000000-0000-0000-0000-00000000000a');
do $$ declare r jsonb := public.people_mission(); begin
  assert r->>'id' is null and (r->>'need')::int = 2, 'missão antes do mínimo de convidados: ' || r;
end $$;
reset role;

-- two more guests: Caio agreed to face recognition with a selfie, Duda did not
insert into public.guests (id, name, face_opt_in) values
  ('10000000-0000-0000-0000-0000000000c1', 'Caio', true),
  ('10000000-0000-0000-0000-0000000000d1', 'Duda', false);
insert into public.face_refs (guest_id, embedding)
values ('10000000-0000-0000-0000-0000000000c1', array_fill(0.2::real, array[512])::vector);

select public.test_as('00000000-0000-0000-0000-00000000000a');
create temp table test_m on commit drop as select (public.people_mission()->>'id')::uuid as id;
do $$ declare m public.missions; begin
  select * into m from public.missions where id = (select id from test_m);
  assert m.id is not null, 'convidado não ganhou missão';
  assert m.owner = '10000000-0000-0000-0000-00000000000a', 'missão sem dono certo';
  assert cardinality(m.targets) = 1 and m.points = 10, 'primeira missão não é com 1 pessoa valendo 10';
  assert m.targets[1] in ('10000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-0000000000c1'),
    'sorteou alguém sem rosto cadastrado ou a própria pessoa';
  -- asking again gives the same open mission
  assert (public.people_mission()->>'id')::uuid = m.id, 'pedir de novo criou outra missão';
end $$;

-- swap: someone else, the old one is closed, and only gen_swaps times
do $$ declare old public.missions; r jsonb; m public.missions; begin
  select * into old from public.missions where id = (select id from test_m);
  r := public.people_swap(old.id);
  select * into m from public.missions where id = (r->>'id')::uuid;
  assert m.targets[1] <> old.targets[1], 'trocar sorteou a mesma pessoa';
  assert not (select active from public.missions where id = old.id), 'missão trocada continuou aberta';
  assert (r->>'swaps_left')::int = 0, 'contagem de trocas errada';
  begin
    perform public.people_swap(m.id);
    assert false, 'trocou mais vezes que o limite';
  exception when others then null;
  end;
end $$;
reset role;

-- the organizer can turn them off
update public.event_config set gen_missions = false;
select public.test_as('00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (public.people_mission()->>'off')::boolean, 'missões com pessoas desligadas ainda sorteiam';
end $$;
reset role;
rollback;
