-- The face data goes by itself a week after the party: signatures, the faces found in photos and the selfie
-- files (queued for the r2 function). Not before, only once, and a guest leaving the recognition has their
-- selfie file queued too. Nobody from the app reads the queue or calls the functions.
begin;
insert into public.photos (id, guest_id, kind, original_path, preview_path, faces_status) values
  ('32000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000c', 'party', 'party/10000000-0000-0000-0000-00000000000c/32000000-0000-0000-0000-000000000001.jpg', 'party/10000000-0000-0000-0000-00000000000c/32000000-0000-0000-0000-000000000001-p.jpg', 'pending');
insert into public.face_vectors (photo_id, idx, embedding)
  values ('32000000-0000-0000-0000-000000000001', 0, array_fill(0.1::real, array[512])::extensions.vector);
insert into public.face_refs (guest_id, embedding)
  values ('10000000-0000-0000-0000-00000000000a', array_fill(0.1::real, array[512])::extensions.vector);
update public.guests set selfie_path = 'selfie/10000000-0000-0000-0000-00000000000a/1.jpg', face_status = 'ready'
  where name = 'Ana';
update public.guests set selfie_path = 'selfie/10000000-0000-0000-0000-00000000000b/1.jpg', face_status = 'ready'
  where name = 'Bia';

do $$ begin
  assert not has_table_privilege('authenticated', 'public.apagar_arquivos', 'select'), 'convidado lê a fila de apagar';
  assert not has_function_privilege('authenticated', 'public.forget_faces(boolean)', 'execute'), 'convidado apaga os rostos';
  assert not has_function_privilege('authenticated', 'public.forget_faces_when_due()', 'execute'), 'convidado chama o apagamento';
end $$;

-- Bia leaves the recognition: her selfie file is queued, Ana's stays
select public.test_as('00000000-0000-0000-0000-00000000000b');
select public.face_opt_out();
reset role;
do $$ begin
  assert exists (select 1 from public.apagar_arquivos where path = 'selfie/10000000-0000-0000-0000-00000000000b/1.jpg'), 'selfie de quem saiu não foi pra fila';
  assert not exists (select 1 from public.apagar_arquivos where path like 'selfie/10000000-0000-0000-0000-00000000000a/%'), 'selfie de outra pessoa foi pra fila';
end $$;

-- the party ended 3 days ago: nothing goes yet
update public.event_config set party_ends = now() - interval '3 days';
select public.forget_faces_when_due();
do $$ begin
  assert (select embedding is not null from public.face_refs where guest_id = '10000000-0000-0000-0000-00000000000a'), 'apagou antes da hora';
  assert (select faces_on from public.event_config), 'desligou antes da hora';
end $$;

-- a week and a day after: everything goes, and recognition is off
update public.event_config set party_ends = now() - interval '8 days';
select public.forget_faces_when_due();
do $$ begin
  assert not exists (select 1 from public.face_refs where embedding is not null), 'assinatura de rosto ficou';
  assert not exists (select 1 from public.face_vectors), 'rostos das fotos ficaram';
  assert not exists (select 1 from public.guests where selfie_path is not null or face_status <> 'none'), 'selfie ficou no convidado';
  assert exists (select 1 from public.apagar_arquivos where path = 'selfie/10000000-0000-0000-0000-00000000000a/1.jpg'), 'arquivo da selfie não foi pra fila';
  assert exists (select 1 from public.apagar_arquivos where path = 'party/10000000-0000-0000-0000-00000000000c/32000000-0000-0000-0000-000000000001-f.jpg'), 'cópia pro leitor não foi pra fila';
  assert (select faces_status from public.photos where id = '32000000-0000-0000-0000-000000000001') = 'skip', 'foto ficou esperando o leitor';
  assert not (select faces_on from public.event_config), 'reconhecimento continuou ligado';
  assert (select faces_forgotten_at is not null from public.event_config), 'não anotou que apagou';
end $$;

-- only once: the organizer switching recognition back on later is not undone every day
update public.event_config set faces_on = true;
select public.forget_faces_when_due();
do $$ begin
  assert (select faces_on from public.event_config), 'apagou de novo e desligou outra vez';
end $$;
rollback;
