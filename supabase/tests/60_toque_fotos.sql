-- The face server's bookkeeping does not count as a change phones must read again; a change they show does.
begin;
select public.test_as('00000000-0000-0000-0000-00000000000a');
select public.send_photo('20000000-0000-0000-0000-000000000060', 'party', 'oi', 'classic', 0,
  'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000060.jpg',
  'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000060-p.jpg', 1000);
reset role;
create temp table before as select updated_at as at from public.photos where id = '20000000-0000-0000-0000-000000000060';
update public.photos set rescan = true, faces_claimed_at = now() where id = '20000000-0000-0000-0000-000000000060';
do $$ begin
  assert (select updated_at from public.photos where id = '20000000-0000-0000-0000-000000000060') = (select at from before),
    'marcar pra procurar rostos de novo fez os celulares lerem a foto de novo';
end $$;
update public.photos set caption = 'mudou' where id = '20000000-0000-0000-0000-000000000060';
do $$ begin
  assert (select updated_at from public.photos where id = '20000000-0000-0000-0000-000000000060') > (select at from before),
    'mudar a legenda não avisou os celulares';
end $$;
rollback;
