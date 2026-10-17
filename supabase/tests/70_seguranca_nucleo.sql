-- A removed photo keeps nothing anyone could open; phones hear only about changes they show; a selfie
-- read after recognition was turned off is not kept; old untagged faces are no longer told.
begin;
select public.test_as('00000000-0000-0000-0000-00000000000a');
select public.send_photo('20000000-0000-0000-0000-000000000070', 'party', 'segredo', 'classic', 0,
  'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000070.jpg',
  'party/10000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000070-p.jpg', 1000);
reset role;
update public.photos set preview_url = 'https://r2.example/p', thumb_url = 'https://r2.example/t', links_until = now() + interval '1 day'
where id = '20000000-0000-0000-0000-000000000070';

-- the face server taking photos off the queue (even none) does not nudge the phones
insert into public.live_dirty (tbl) select 'photos' where not exists (select 1 from public.live_dirty where tbl = 'photos');
update public.live_dirty set changed_at = '2000-01-01' where tbl = 'photos';
create temp table mark as select changed_at as at from public.live_dirty where tbl = 'photos';
update public.photos set faces_claimed_at = now() where id = '20000000-0000-0000-0000-000000000070';
update public.photos set faces_claimed_at = now() where false;
do $$ begin
  assert (select changed_at from public.live_dirty where tbl = 'photos') is not distinct from (select at from mark),
    'o servidor de rostos pegando fotos avisou os celulares';
end $$;

select public.test_as('00000000-0000-0000-0000-00000000000a');
select public.hide_photo('20000000-0000-0000-0000-000000000070');
reset role;
do $$ begin
  assert (select caption = '' and preview_url is null and thumb_url is null and links_until is null and removed_at is not null
          from public.photos where id = '20000000-0000-0000-0000-000000000070'),
    'foto removida continuou com legenda ou links';
  assert (select changed_at from public.live_dirty where tbl = 'photos') > (select at from mark),
    'remover a foto não avisou os celulares';
end $$;

-- a selfie read after the guest turned recognition off is thrown away
update public.guests set face_opt_in = false, face_status = 'none' where id = '10000000-0000-0000-0000-00000000000b';
do $$ begin
  assert public.face_save_selfie('10000000-0000-0000-0000-00000000000b', (select jsonb_agg(0.01) from generate_series(1, 512))) = 0,
    'selfie salva de quem desligou';
  assert not exists (select 1 from public.face_refs where guest_id = '10000000-0000-0000-0000-00000000000b' and embedding is not null),
    'rosto guardado de quem desligou o reconhecimento';
  assert (select face_status from public.guests where id = '10000000-0000-0000-0000-00000000000b') = 'none',
    'reconhecimento voltou a ligar sozinho';
end $$;

-- tags taken off are told for a day, then no longer
insert into public.photo_faces (photo_id, guest_id, score, updated_at) values
  ('20000000-0000-0000-0000-000000000070', '10000000-0000-0000-0000-00000000000a', -1, now() - interval '2 days'),
  ('20000000-0000-0000-0000-000000000070', '10000000-0000-0000-0000-00000000000b', -1, now());
select public.test_as('00000000-0000-0000-0000-00000000000a');
do $$ begin
  assert not exists (select 1 from public.faces_since('2000-01-01') where guest_id = '10000000-0000-0000-0000-00000000000a' and not shown),
    'marcação tirada há dias ainda aparece';
  assert exists (select 1 from public.faces_since('2000-01-01') where guest_id = '10000000-0000-0000-0000-00000000000b' and not shown),
    'marcação tirada agora não chega aos celulares';
end $$;
reset role;
rollback;
