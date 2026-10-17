-- A changed mission says when; a guest keeps at most 5 phones signed up for reminders; nothing granted to
-- phones beyond reading, and no table streams its changes to the realtime server.
begin;
insert into public.missions (id, title, points, updated_at) values ('30000000-0000-0000-0000-000000000090', 'Teste', 10, '2000-01-01');
update public.missions set points = 20 where id = '30000000-0000-0000-0000-000000000090';
do $$ begin
  assert (select updated_at > now() - interval '1 minute' from public.missions where id = '30000000-0000-0000-0000-000000000090'),
    'missão mudou sem dizer quando';
end $$;

select public.test_as('00000000-0000-0000-0000-00000000000a');
do $$ begin
  for i in 1..7 loop perform public.save_push('', 'https://fcm.googleapis.com/fcm/send/teste' || i, 'p256dh', 'auth'); end loop;
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.push_subs where guest_id = '10000000-0000-0000-0000-00000000000a' and removed_at is null) = 5,
    'convidado com mais de 5 celulares nos avisos';
  assert exists (select 1 from public.push_subs where endpoint = 'https://fcm.googleapis.com/fcm/send/teste7' and removed_at is null),
    'o celular mais novo ficou sem aviso';
end $$;

-- someone not signed up yet: no guest behind the call
select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);
set local role anon;
select public.save_push('', 'https://fcm.googleapis.com/fcm/send/anonimo', 'p256dh', 'auth');
reset role;
do $$ begin
  assert exists (select 1 from public.push_subs where endpoint = 'https://fcm.googleapis.com/fcm/send/anonimo' and guest_id is null and removed_at is null),
    'lembrete antes da festa não foi salvo';
  assert not has_table_privilege('anon', 'public.admin_attempts', 'truncate'), 'qualquer um apaga as tentativas do organizador';
  assert not has_table_privilege('authenticated', 'public.rostos_dispatch', 'delete'), 'convidado mexe no disparo dos rostos';
  assert not has_table_privilege('authenticated', 'public.missions', 'trigger'), 'convidado com permissão de trigger';
  assert not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'),
    'tabela ainda manda mudanças pro realtime';
end $$;
rollback;
