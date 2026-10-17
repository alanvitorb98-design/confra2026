-- Test photos (organizers before the party) are seen only by organizers.
begin;
insert into public.photos (id, guest_id, kind, original_path, preview_path, test) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000c', 'party', 'party/10000000-0000-0000-0000-00000000000c/30000000-0000-0000-0000-000000000001.jpg', 'party/10000000-0000-0000-0000-00000000000c/30000000-0000-0000-0000-000000000001-p.jpg', true),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000c', 'party', 'party/10000000-0000-0000-0000-00000000000c/30000000-0000-0000-0000-000000000002.jpg', 'party/10000000-0000-0000-0000-00000000000c/30000000-0000-0000-0000-000000000002-p.jpg', false);
select public.test_as('00000000-0000-0000-0000-00000000000a');
do $$ begin
  assert (select count(*) from public.photos where id::text like '30000000%') = 1, 'convidado viu foto de teste';
end $$;
reset role;
select public.test_as('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from public.photos where id::text like '30000000%') = 2, 'organizador não viu a foto de teste';
end $$;
reset role;
-- without a login nothing is visible
set local role anon;
do $$ begin
  assert (select count(*) from public.photos) = 0, 'visitante sem login viu fotos';
exception when insufficient_privilege then null;
end $$;
rollback;
