-- A mission with people counts when the recognition finds them, or when an organizer tags them by hand
-- (the recognition can miss someone with a hard selfie). The guest's own tag by hand never counts.
begin;
insert into public.missions (id, title, points, owner, targets) values
  ('42000000-0000-0000-0000-000000000001', 'Foto com Bia', 10, '10000000-0000-0000-0000-00000000000a', array['10000000-0000-0000-0000-00000000000b']::uuid[]);
insert into public.photos (id, guest_id, kind, original_path, preview_path, faces_status, mission_id) values
  ('42000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000a', 'party', 'party/10000000-0000-0000-0000-00000000000a/42000000-0000-0000-0000-0000000000f1.jpg', 'party/10000000-0000-0000-0000-00000000000a/42000000-0000-0000-0000-0000000000f1-p.jpg', 'done', '42000000-0000-0000-0000-000000000001');
do $$ begin
  assert (select mission_ok from public.photos where id = '42000000-0000-0000-0000-0000000000f1') = false, 'missão valeu sem ninguém';
end $$;

-- Ana (a guest) tags Bia herself: still not valid
select public.test_as('00000000-0000-0000-0000-00000000000a');
select public.tag_spot('42000000-0000-0000-0000-0000000000f1', null, 0.5, 0.5, '10000000-0000-0000-0000-00000000000b');
reset role;
do $$ begin
  assert (select mission_ok from public.photos where id = '42000000-0000-0000-0000-0000000000f1') = false, 'marcação do próprio convidado valeu missão';
  assert not public.mission_org_tag('42000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-00000000000b'), 'marcação de convidado contou como organizador';
end $$;

-- the organizer tags Bia on that same face: now it counts
select public.test_as('00000000-0000-0000-0000-00000000000c');
select public.tag_spot('42000000-0000-0000-0000-0000000000f1', (select id from public.photo_spots where photo_id = '42000000-0000-0000-0000-0000000000f1' and guest_id = '10000000-0000-0000-0000-00000000000b'), null, null, '10000000-0000-0000-0000-00000000000b');
reset role;
do $$ begin
  assert (select mission_ok from public.photos where id = '42000000-0000-0000-0000-0000000000f1'), 'marcação do organizador não valeu missão';
end $$;

-- the organizer takes the tag off: not valid again
select public.test_as('00000000-0000-0000-0000-00000000000c');
select public.tag_spot('42000000-0000-0000-0000-0000000000f1', (select id from public.photo_spots where photo_id = '42000000-0000-0000-0000-0000000000f1' and guest_id = '10000000-0000-0000-0000-00000000000b'), null, null, null);
reset role;
do $$ begin
  assert (select mission_ok from public.photos where id = '42000000-0000-0000-0000-0000000000f1') = false, 'missão continuou valendo sem a marcação';
  assert not has_function_privilege('authenticated', 'public.mission_org_tag(uuid, uuid)', 'execute'), 'convidado chama mission_org_tag';
end $$;
rollback;
