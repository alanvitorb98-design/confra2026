-- Health of the services, checked every 5 minutes. Each check has a free-plan limit and a status
-- (ok / atencao / critico); the `saude` edge function compares with the last check and pushes a notice to the
-- organizers' phones when something gets worse or goes back to normal.

-- which phone belongs to whom, so health notices go only to organizers
alter table public.push_subs add column if not exists guest_id uuid references public.guests (id) on delete set null;

create or replace function public.save_push(p_code text, p_endpoint text, p_p256dh text, p_auth text)
returns boolean language plpgsql security definer set search_path to '' as $$
begin
  if p_endpoint !~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]*\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]*\.notify\.windows\.com|[a-z0-9.-]*\.push\.samsungosp\.com)/'
     or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'inscrição inválida';
  end if;
  if (select count(*) from public.push_subs where removed_at is null) >= 3000 then raise exception 'limite'; end if;
  insert into public.push_subs (endpoint, p256dh, auth, guest_id) values (p_endpoint, p_p256dh, p_auth, public.my_guest())
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, removed_at = null,
    guest_id = coalesce(excluded.guest_id, public.push_subs.guest_id);
  return true;
end $$;

-- the app checks its push on every open: also links phones subscribed before guest_id existed
create or replace function public.push_alive(p_endpoint text, p_auth text)
returns boolean language plpgsql security definer set search_path to '' as $$
declare g uuid := public.my_guest();
begin
  if g is not null then
    update public.push_subs set guest_id = g where endpoint = p_endpoint and auth = p_auth and removed_at is null and guest_id is distinct from g;
  end if;
  return exists (select 1 from public.push_subs where endpoint = p_endpoint and auth = p_auth and removed_at is null);
end $$;

create table if not exists public.saude_estado (
  item text primary key,
  status text not null,
  texto text not null,
  desde timestamptz not null default now()
);
alter table public.saude_estado enable row level security;
revoke all on public.saude_estado from anon, authenticated;

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

  -- space, against the free plan
  mb := pg_database_size(current_database()) / 1048576.0;
  pct := mb / 500 * 100;
  out := out || jsonb_build_object('item', 'banco', 'pct', round(pct), 'texto', format('Banco: %s MB de 500 MB (%s%%)', round(mb), round(pct)));
  mb := coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0) / 1048576.0;
  pct := mb / 1024 * 100;
  out := out || jsonb_build_object('item', 'arquivos', 'pct', round(pct), 'texto', format('Arquivos no Supabase: %s MB de 1 GB (%s%%)', round(mb), round(pct)));
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

select cron.schedule('saude', '*/5 * * * *', $c$select net.http_post('https://optapzbhyhklcirdoyid.supabase.co/functions/v1/saude', '{}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb)$c$);
