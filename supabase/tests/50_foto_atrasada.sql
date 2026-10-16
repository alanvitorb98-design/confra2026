-- A photo taken while the camera was open but sent after it closed is still accepted for 3 days.
-- The phone makes the photo id as a UUID v7, so the server can read when it was taken.
begin;
create function public.test_v7(p timestamptz, p_n int) returns uuid language sql as $$
  select (lpad(to_hex((extract(epoch from p) * 1000)::bigint), 12, '0') || '7000' || '8000' || lpad(to_hex(p_n), 12, '0'))::uuid
$$;
grant execute on function public.test_v7(timestamptz, int) to authenticated;
-- the party ended yesterday
update public.event_config set party_starts = now() - interval '30 hours', party_ends = now() - interval '24 hours';

do $$ declare t timestamptz := now() - interval '25 hours'; begin
  assert abs(extract(epoch from public.photo_taken_at(public.test_v7(t, 1)) - t)) < 0.001, 'hora da foto lida errada';
  assert public.photo_taken_at('20000000-0000-4000-8000-000000000001') is null, 'id antigo ganhou hora';
end $$;

select public.test_as('00000000-0000-0000-0000-00000000000a');
create temp table ids as select
  public.test_v7(now() - interval '25 hours', 1) as inside,
  public.test_v7(now() - interval '23 hours', 2) as after,
  '20000000-0000-4000-8000-0000000000aa'::uuid as old;
-- taken an hour before the end, sent now: kept
do $$ declare i uuid := (select inside from ids); begin
  perform public.send_photo(i, 'party', '', 'classic', 0,
    'party/10000000-0000-0000-0000-00000000000a/' || i || '.jpg', 'party/10000000-0000-0000-0000-00000000000a/' || i || '-p.jpg', 1);
end $$;
-- taken after the end: refused
do $$ declare i uuid := (select after from ids); begin
  perform public.send_photo(i, 'party', '', 'classic', 0,
    'party/10000000-0000-0000-0000-00000000000a/' || i || '.jpg', 'party/10000000-0000-0000-0000-00000000000a/' || i || '-p.jpg', 1);
  raise exception 'foto tirada depois da festa entrou';
exception when others then
  if sqlerrm <> 'câmera fechada' then raise; end if;
end $$;
-- an id without a time: the old rule
do $$ declare i uuid := (select old from ids); begin
  perform public.send_photo(i, 'party', '', 'classic', 0,
    'party/10000000-0000-0000-0000-00000000000a/' || i || '.jpg', 'party/10000000-0000-0000-0000-00000000000a/' || i || '-p.jpg', 1);
  raise exception 'foto sem hora entrou depois da festa';
exception when others then
  if sqlerrm <> 'câmera fechada' then raise; end if;
end $$;
reset role;
do $$ begin
  assert (select not test from public.photos where id = (select inside from ids)), 'foto atrasada não entrou no feed';
end $$;

-- four days later the late photo is no longer taken
update public.event_config set party_starts = now() - interval '102 hours', party_ends = now() - interval '96 hours';
select public.test_as('00000000-0000-0000-0000-00000000000a');
do $$ declare i uuid := public.test_v7(now() - interval '97 hours', 3); begin
  perform public.send_photo(i, 'party', '', 'classic', 0,
    'party/10000000-0000-0000-0000-00000000000a/' || i || '.jpg', 'party/10000000-0000-0000-0000-00000000000a/' || i || '-p.jpg', 1);
  raise exception 'foto atrasada entrou depois de 3 dias';
exception when others then
  if sqlerrm <> 'câmera fechada' then raise; end if;
end $$;
rollback;
