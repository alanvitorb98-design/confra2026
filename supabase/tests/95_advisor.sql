-- Trigger functions cannot be called by phones, and still run as triggers; the mission helpers have a fixed search_path.
begin;
do $$ begin
  assert not has_function_privilege('anon', 'public.photo_store()', 'execute'), 'visitante chama função de trigger';
  assert not has_function_privilege('authenticated', 'public.mission_verdict()', 'execute'), 'convidado chama função de trigger';
  assert (select proconfig is not null from pg_proc where oid = 'public.people_title(text[])'::regprocedure), 'search_path solto';
end $$;
select public.test_as('00000000-0000-0000-0000-00000000000a');
select public.send_photo('20000000-0000-0000-0000-000000000095', 'party', '', 'classic', 0,
  'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000095.jpg',
  'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000095-p.jpg', 1000);
reset role;
do $$ begin
  assert exists (select 1 from public.photos where id = '20000000-0000-0000-0000-000000000095'), 'foto não entrou sem a permissão da trigger';
end $$;
rollback;
