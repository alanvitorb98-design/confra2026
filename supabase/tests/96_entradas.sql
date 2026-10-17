-- Odd input from a phone is refused or kept as plain text, never followed: file paths outside the guest's own
-- file, unknown kinds, frames and emoji, oversized names, text that looks like code.
begin;
select public.test_as('00000000-0000-0000-0000-00000000000a');
do $$ begin
  perform public.send_photo('20000000-0000-0000-0000-000000000096', 'party', '', 'classic', 0,
    'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000096/../../10000000-0000-0000-0000-00000000000b/x.jpg',
    'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000096-p.jpg', 1);
  raise exception 'caminho com .. entrou';
exception when others then
  if sqlerrm <> 'caminho inválido' then raise; end if;
end $$;
do $$ begin
  perform public.send_photo('20000000-0000-0000-0000-000000000096', '.*', '', 'classic', 0,
    'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000096.jpg',
    'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000096-p.jpg', 1);
  raise exception 'tipo de foto inventado entrou';
exception when others then
  if sqlerrm <> 'tipo inválido' then raise; end if;
end $$;
do $$ begin
  perform public.send_photo('20000000-0000-0000-0000-000000000096', 'party', '', 'neon', 0,
    'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000096.jpg',
    'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000096-p.jpg', 1);
  raise exception 'moldura inventada entrou';
exception when check_violation then null;
end $$;

-- text that looks like code is kept exactly as typed
select public.send_photo('20000000-0000-0000-0000-000000000096', 'party', $t$'); drop table photos; -- <b>oi</b>$t$, 'classic', 0,
  'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000096.jpg',
  'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000096-p.jpg', 1);
do $$ begin
  assert (select caption from public.photos where id = '20000000-0000-0000-0000-000000000096') = $t$'); drop table photos; -- <b>oi</b>$t$,
    'legenda não ficou igual ao digitado';
end $$;

do $$ begin
  perform public.set_reaction('20000000-0000-0000-0000-000000000096', '💩', true);
  raise exception 'emoji fora da lista entrou';
exception when check_violation then null;
end $$;
do $$ begin
  perform public.update_profile(repeat('a', 41), null, false);
  raise exception 'nome gigante entrou';
exception when check_violation then null;
end $$;
do $$ begin
  perform public.update_profile('Ana', 'ana" onclick="x', false);
  raise exception 'instagram com aspas entrou';
exception when check_violation then null;
end $$;

-- another guest's photo: hiding does nothing, tagging is refused
select public.test_as('00000000-0000-0000-0000-00000000000b');
select public.hide_photo('20000000-0000-0000-0000-000000000096');
do $$ begin
  assert (select removed_at is null from public.photos where id = '20000000-0000-0000-0000-000000000096'), 'outra pessoa apagou a foto';
end $$;
do $$ begin
  perform public.tag_spot('20000000-0000-0000-0000-000000000096', null, 0.5, 0.5, '10000000-0000-0000-0000-00000000000b');
  raise exception 'outra pessoa marcou gente na foto';
exception when others then
  if sqlerrm <> 'só quem tirou a foto marca' then raise; end if;
end $$;
reset role;

-- and the table refuses a bad path whoever writes it
do $$ begin
  update public.photos set preview_path = 'selfie/10000000-0000-0000-0000-00000000000b/x.jpg' where id = '20000000-0000-0000-0000-000000000096';
  raise exception 'tabela aceitou caminho de outra pasta';
exception when check_violation then null;
end $$;
rollback;
