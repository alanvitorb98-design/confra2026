-- Face queue: two servers never get the same item, a new selfie is read right away, and a server is
-- only started when there is work.
begin;
update public.guests set selfie_path = 'selfie/x/1.jpg', face_status = 'pending' where name in ('Ana', 'Bia');
do $$
declare a jsonb; b jsonb;
begin
  a := public.face_claim(1, 0);
  b := public.face_claim(1, 0);
  assert jsonb_array_length(a->'selfies') = 1 and jsonb_array_length(b->'selfies') = 1, 'servidor ficou sem selfie';
  assert a->'selfies'->0->>'id' <> b->'selfies'->0->>'id', 'dois servidores pegaram a mesma selfie';
  assert jsonb_array_length(public.face_claim(4, 0)->'selfies') = 0, 'selfie entregue de novo antes de 5 minutos';
end $$;

-- Ana's selfie was just read; she sends a new one and it must be free to take at once
update public.guests set face_status = 'ready' where name = 'Ana';
select public.test_as('00000000-0000-0000-0000-00000000000a');
select public.set_selfie('selfie/10000000-0000-0000-0000-00000000000a/2.jpg');
reset role;
do $$ begin
  assert (public.face_claim(4, 0)->'selfies'->0->>'id') = '10000000-0000-0000-0000-00000000000a', 'selfie nova ficou esperando';
end $$;
rollback;

begin;
do $$ begin
  assert not public.rostos_allow('drain'), 'servidor ligado com a fila vazia';
end $$;
delete from public.test_calls;
update public.guests set selfie_path = 'selfie/x/1.jpg', face_status = 'pending' where name = 'Bia';
do $$ begin
  assert (select count(*) from public.test_calls where what = 'rostos') >= 1, 'selfie nova não ligou o servidor';
end $$;
rollback;
