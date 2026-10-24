-- Invitations: the organizer makes personal links (with seats for a family), the join function reads who came
-- in with each, a guest's name is found again ignoring case and accents, and the organizer can show anyone's
-- código de volta. Phones never reach the invitation tables or the join function's helpers.
begin;
do $$ begin
  assert not has_function_privilege('anon', 'public.invite_peek(text)', 'execute'), 'visitante lê convite';
  assert not has_function_privilege('authenticated', 'public.invite_peek(text)', 'execute'), 'convidado lê convite';
  assert not has_function_privilege('authenticated', 'public.guest_name_taken(text)', 'execute'), 'convidado testa nomes';
  assert not has_function_privilege('authenticated', 'public.return_code_for(uuid)', 'execute'), 'convidado pega código de outro';
  assert not has_table_privilege('authenticated', 'public.invites', 'select'), 'convidado lê a tabela de convites';

  assert public.guest_name_taken('  ana '), 'nome igual com espaço e minúscula não achou';
  assert public.guest_name_taken('Âna'), 'nome igual com acento não achou';
  assert not public.guest_name_taken('Ana Paula'), 'nome diferente achou';
end $$;

select public.test_as('00000000-0000-0000-0000-00000000000a');
do $$ begin
  perform public.admin_invites_add('Família Ana');
  raise exception 'convidado criou convite';
exception when others then
  if sqlerrm <> 'só organizador' then raise; end if;
end $$;
do $$ begin
  perform public.admin_return_code('10000000-0000-0000-0000-00000000000b');
  raise exception 'convidado pegou código de volta de outro';
exception when others then
  if sqlerrm <> 'só organizador' then raise; end if;
end $$;
create temp table mine as select public.my_return_code() as code;
grant select on mine to authenticated;

select public.test_as('00000000-0000-0000-0000-00000000000c');
do $$
declare made int; list jsonb; souza jsonb;
begin
  made := public.admin_invites_add(E'Família Souza; 4\n  Tia Lu  \n\n' || E'Primos\t3\nMuitos; 99');
  assert made = 4, 'fez ' || made || ' convites';
  list := public.admin_invites();
  select x into souza from jsonb_array_elements(list) x where x->>'label' = 'Família Souza';
  assert (souza->>'seats')::int = 4, 'família não ficou com 4 lugares';
  assert (select (x->>'seats')::int from jsonb_array_elements(list) x where x->>'label' = 'Tia Lu') = 1, 'sem número não ficou com 1';
  assert (select (x->>'seats')::int from jsonb_array_elements(list) x where x->>'label' = 'Primos') = 3, 'tab do Excel não leu';
  assert (select (x->>'seats')::int from jsonb_array_elements(list) x where x->>'label' = 'Muitos') = 20, 'lugares sem teto';
  assert souza->>'token' ~ '^[A-Z0-9]{10}$', 'token estranho: ' || (souza->>'token');
  assert (select count(distinct x->>'token') from jsonb_array_elements(list) x) = 4, 'token repetido';

  perform public.admin_invite_set((souza->>'id')::uuid, '{"revoked": true, "seats": 2}');
  assert (select (x->>'revoked')::boolean and (x->>'seats')::int = 2 from jsonb_array_elements(public.admin_invites()) x where x->>'label' = 'Família Souza'),
    'cancelar/mudar lugares não pegou';

  assert public.admin_return_code('10000000-0000-0000-0000-00000000000a') = (select code from mine), 'código do organizador difere do da Ana';
  assert (select count(*) from jsonb_array_elements(public.admin_find_guests('ÁN')) x where x->>'name' = 'Ana') = 1, 'busca não achou a Ana';
  assert public.admin_find_guests('a') = '[]'::jsonb, 'busca de uma letra listou todo mundo';

  perform public.admin_update_event('{"invite_only": true}');
  assert (public.event_public()->>'invite_only')::boolean, 'só com convite não ligou';
  perform public.admin_update_event('{"place": "Outro lugar"}');
  assert (public.event_public()->>'invite_only')::boolean, 'salvar outro campo desligou o convite';
end $$;

-- the join function's view of an invitation: who came in with it, in order
reset role;
do $$
declare t text; p jsonb;
begin
  select token into t from public.invites where label = 'Primos';
  update public.guests set invite_id = (select id from public.invites where token = t) where name in ('Ana', 'Bia');
  p := public.invite_peek(lower(substr(t, 1, 5)) || '-' || substr(t, 6));
  assert p->>'label' = 'Primos' and not (p->>'revoked')::boolean, 'convite não achado pelo link digitado';
  assert jsonb_array_length(p->'people') = 2, 'não listou quem entrou';
  assert public.invite_peek('NAOEXISTE1') is null, 'token inventado achou convite';
end $$;

-- the seats are counted by the database itself, so two phones on the same link at once cannot both take the last
-- one (supabase/tests/corrida.sh runs them really at the same time)
do $$
declare tia uuid := (select id from public.invites where label = 'Tia Lu');
begin
  insert into public.guests (name, invite_id) values ('Tia Lu', tia);
  begin
    insert into public.guests (name, invite_id) values ('Penetra', tia);
    raise exception 'entrou mais gente que os lugares';
  exception when others then
    if sqlerrm <> 'cheio' then raise; end if;
  end;
  begin
    update public.guests set invite_id = tia where name = 'Org';
    raise exception 'mudar de convite passou dos lugares';
  exception when others then
    if sqlerrm <> 'cheio' then raise; end if;
  end;
  update public.guests set name = 'Tia Lúcia' where invite_id = tia;
  begin
    insert into public.guests (name, invite_id) values ('Atrasado', (select id from public.invites where label = 'Família Souza'));
    raise exception 'convite cancelado deixou entrar';
  exception when others then
    if sqlerrm <> 'convite' then raise; end if;
  end;
end $$;
rollback;
