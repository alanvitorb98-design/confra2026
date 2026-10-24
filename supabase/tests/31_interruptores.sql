-- The organizer's switches for the day: recognition paused means no reader is started and a running one finds
-- nothing; the switches reach the phones through event_public; only an organizer can flip them.
begin;
update public.guests set selfie_path = 'selfie/x/1.jpg', face_status = 'pending' where name = 'Bia';
do $$ begin
  assert public.face_work_waiting(), 'selfie esperando não contou como trabalho';
  assert (public.event_public()->>'faces_on')::boolean and (public.event_public()->>'missions_on')::boolean
     and (public.event_public()->>'ranking_on')::boolean, 'interruptores não vêm ligados';
end $$;

select public.test_as('00000000-0000-0000-0000-00000000000a');
do $$ begin
  perform public.admin_update_event('{"faces_on": false}');
  raise exception 'convidado desligou o reconhecimento';
exception when others then
  if sqlerrm <> 'só organizador' then raise; end if;
end $$;

select public.test_as('00000000-0000-0000-0000-00000000000c');
select public.admin_update_event('{"faces_on": false, "ranking_on": false}');
reset role;
do $$ begin
  assert not public.face_work_waiting(), 'reconhecimento pausado ainda chama o leitor';
  assert jsonb_array_length(public.face_claim(4, 6)->'selfies') = 0, 'leitor pegou selfie com o reconhecimento pausado';
  assert not (public.event_public()->>'faces_on')::boolean, 'celular não soube da pausa';
  assert not (public.event_public()->>'ranking_on')::boolean, 'ranking não desligou';
  assert (public.event_public()->>'missions_on')::boolean, 'missões desligaram sem pedir';
end $$;

select public.test_as('00000000-0000-0000-0000-00000000000c');
select public.admin_update_event('{"place": "Outro lugar"}');
reset role;
do $$ begin
  assert not (public.event_public()->>'faces_on')::boolean, 'salvar outro campo religou o reconhecimento';
end $$;

select public.test_as('00000000-0000-0000-0000-00000000000c');
select public.admin_update_event('{"faces_on": true}');
reset role;
do $$ begin
  assert jsonb_array_length(public.face_claim(4, 6)->'selfies') = 1, 'religado, a selfie não voltou pra fila';
end $$;
rollback;
