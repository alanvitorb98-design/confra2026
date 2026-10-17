-- A reaction sent twice, or answered out of order, ends as the phone wanted; nobody can read the sign-up keys.
begin;
select public.test_as('00000000-0000-0000-0000-00000000000a');
select public.send_photo('20000000-0000-0000-0000-000000000080', 'party', '', 'classic', 0,
  'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000080.jpg',
  'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000080-p.jpg', 1000);
select public.test_as('00000000-0000-0000-0000-00000000000b');
select public.set_reaction('20000000-0000-0000-0000-000000000080', '🔥', true);
select public.set_reaction('20000000-0000-0000-0000-000000000080', '🔥', true);
do $$ begin
  assert (select active from public.reactions where photo_id = '20000000-0000-0000-0000-000000000080' and guest_id = '10000000-0000-0000-0000-00000000000b' and emoji = '🔥'),
    'reação enviada duas vezes se desfez';
end $$;
select public.set_reaction('20000000-0000-0000-0000-000000000080', '🔥', false);
select public.set_reaction('20000000-0000-0000-0000-000000000080', '🔥', false);
do $$ begin
  assert not (select active from public.reactions where photo_id = '20000000-0000-0000-0000-000000000080' and guest_id = '10000000-0000-0000-0000-00000000000b' and emoji = '🔥'),
    'tirar a reação duas vezes ligou ela de novo';
  assert not has_table_privilege('authenticated', 'public.join_keys', 'select'), 'convidado lê as chaves de cadastro';
  assert not has_table_privilege('anon', 'public.join_keys', 'select'), 'qualquer um lê as chaves de cadastro';
end $$;
reset role;
rollback;
