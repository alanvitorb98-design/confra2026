-- The organizer sets the missions with people from the panel; values out of range are clamped, guests can't.
begin;
select public.test_as('00000000-0000-0000-0000-00000000000c');
select public.admin_update_event('{"gen_missions": false, "gen_max_people": 9, "gen_min_guests": 1}');
reset role;
do $$ declare c public.event_config; begin
  select * into c from public.event_config limit 1;
  assert not c.gen_missions, 'organizador não desligou as missões com pessoas';
  assert c.gen_max_people = 6, 'grupo acima de 6 pessoas foi aceito';
  assert c.gen_min_guests = 2, 'mínimo de convidados abaixo de 2 foi aceito';
end $$;
-- saving only the place keeps the mission settings
select public.test_as('00000000-0000-0000-0000-00000000000c');
select public.admin_update_event('{"place": "Salão"}');
reset role;
do $$ begin
  assert (select gen_max_people from public.event_config limit 1) = 6, 'salvar o local mexeu nas missões';
end $$;
select public.test_as('00000000-0000-0000-0000-00000000000a');
do $$ begin
  perform public.admin_update_event('{"gen_missions": true}');
  assert false, 'convidado mudou as missões';
exception when others then null; -- a failed assert is not caught by "others"
end $$;
reset role;
rollback;
