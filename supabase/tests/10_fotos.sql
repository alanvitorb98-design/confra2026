-- Sending photos: the same photo sent twice is kept once; nobody can take another guest's photo id.
begin;
select public.test_as('00000000-0000-0000-0000-00000000000a');
select public.send_photo('20000000-0000-0000-0000-000000000001', 'party', 'oi', 'classic', 0,
  'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000001.jpg',
  'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000001-p.jpg', 1000);
-- the phone lost the answer and sends it again
select public.send_photo('20000000-0000-0000-0000-000000000001', 'party', 'oi', 'classic', 0,
  'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000001.jpg',
  'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000001-p.jpg', 1000);
reset role;
do $$ begin
  assert (select count(*) from public.photos where id = '20000000-0000-0000-0000-000000000001') = 1, 'a foto reenviada duplicou';
  assert not (select test from public.photos where id = '20000000-0000-0000-0000-000000000001'), 'foto da festa virou teste';
end $$;

select public.test_as('00000000-0000-0000-0000-00000000000b');
do $$ begin
  perform public.send_photo('20000000-0000-0000-0000-000000000001', 'party', '', 'classic', 0,
    'party/10000000-0000-0000-0000-00000000000b/20000000-0000-0000-0000-000000000001.jpg',
    'party/10000000-0000-0000-0000-00000000000b/20000000-0000-0000-0000-000000000001-p.jpg', 1);
  raise exception 'outra pessoa conseguiu usar o id da foto';
exception when others then
  if sqlerrm <> 'foto já existe' then raise; end if;
end $$;
-- a path in someone else's folder is refused
do $$ begin
  perform public.send_photo('20000000-0000-0000-0000-000000000002', 'party', '', 'classic', 0,
    'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000002.jpg',
    'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000002-p.jpg', 1);
  raise exception 'foto entrou na pasta de outra pessoa';
exception when others then
  if sqlerrm <> 'caminho inválido' then raise; end if;
end $$;
rollback;
