-- 29/10: the health check measured space against the free plan (500 MB database, 1 GB files). Both projects
-- are on Pro now, and photos kept in the app go past 1 GB during a party, which would send a false
-- "crítico" to the organizers. Same function, Pro limits.
create or replace function public.saude_medir()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare
  c public.event_config;
  out jsonb := '[]';
  mb numeric;
  n numeric;
  m numeric;
  festa boolean;
  pct numeric;
  st text;
begin
  select * into c from public.event_config;
  festa := now() between c.party_starts - interval '30 minutes' and c.party_ends + interval '2 hours';

  -- space, against the Pro plan (8 GB of database disk, 100 GB of files)
  mb := pg_database_size(current_database()) / 1048576.0;
  pct := mb / 8192 * 100;
  out := out || jsonb_build_object('item', 'banco', 'pct', round(pct), 'texto', format('Banco: %s MB de 8 GB (%s%%)', round(mb), round(pct)));
  mb := coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0) / 1048576.0;
  pct := mb / 102400 * 100;
  out := out || jsonb_build_object('item', 'arquivos', 'pct', round(pct), 'texto', format('Arquivos no Supabase: %s GB de 100 GB (%s%%)', round(mb / 1024, 1), round(pct)));
  mb := coalesce((select sum(bytes) from public.photos where on_r2), 0) / 1048576.0;
  pct := mb / 10240 * 100;
  out := out || jsonb_build_object('item', 'r2', 'pct', round(pct), 'texto', format('Originais (Cloudflare): %s GB de 10 GB (%s%%)', round(mb / 1024, 1), round(pct)));

  -- database connections in use
  n := (select count(*) from pg_stat_activity);
  m := current_setting('max_connections')::numeric;
  pct := n / m * 100;
  out := out || jsonb_build_object('item', 'conexoes', 'pct', round(pct), 'texto', format('Conexões do banco: %s de %s', n, m));

  -- the live nudge: its job must have run in the last minute
  n := extract(epoch from now() - coalesce((
    select max(r.end_time) from cron.job_run_details r
    where r.jobid = (select jobid from cron.job where jobname = 'ao-vivo') and r.status = 'succeeded'
      and r.runid > (select coalesce(max(runid), 0) - 200 from cron.job_run_details)
  ), '-infinity')));
  st := case when n > 120 then 'critico' when n > 30 then 'atencao' else 'ok' end;
  out := out || jsonb_build_object('item', 'ao_vivo', 'status', st,
    'texto', case when st = 'ok' then 'Ao vivo: funcionando' else format('Ao vivo: parado há %s min', round(least(n, 99999) / 60)) end);

  -- face queue: only during the party (before it the worker runs on a schedule and waiting is normal)
  if festa and exists (select 1 from public.face_refs where embedding is not null) then
    n := coalesce(extract(epoch from now() - (select min(created_at) from public.photos where faces_status = 'pending' and kind = 'party' and removed_at is null)) / 60, 0);
    st := case when n > 45 then 'critico' when n > 20 then 'atencao' else 'ok' end;
    out := out || jsonb_build_object('item', 'rostos', 'status', st,
      'texto', case when n = 0 then 'Reconhecimento: fila vazia' else format('Reconhecimento: foto mais antiga esperando há %s min', round(n)) end);
  end if;

  -- errors reported by phones in the last 15 minutes
  n := (select count(*) from public.client_errors where at > now() - interval '15 minutes');
  st := case when n >= 50 then 'critico' when n >= 10 then 'atencao' else 'ok' end;
  out := out || jsonb_build_object('item', 'erros', 'status', st, 'texto', format('Erros nos celulares (15 min): %s', n));

  -- percentage checks: 70% attention, 90% critical
  return (
    select jsonb_agg(case when e ? 'status' then e
      else e || jsonb_build_object('status', case when (e->>'pct')::numeric >= 90 then 'critico' when (e->>'pct')::numeric >= 70 then 'atencao' else 'ok' end) end)
    from jsonb_array_elements(out) e
  );
end $$;
revoke all on function public.saude_medir() from public, anon, authenticated;
