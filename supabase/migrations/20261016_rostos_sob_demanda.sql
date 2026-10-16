-- Face worker on demand: GitHub starts a worker only when a selfie or a photo is waiting, and the worker
-- stops a few minutes after the queue empties. Nothing runs while there is nothing to read.

-- the worker's last visit to the queue (face_claim stamps it), so we never start a second one
create table if not exists public.rostos_vivo (id smallint primary key default 1, seen_at timestamptz not null);
alter table public.rostos_vivo enable row level security;
revoke all on public.rostos_vivo from anon, authenticated;

create or replace function public.face_work_waiting()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.guests where face_status = 'pending' and selfie_path is not null)
      or (exists (select 1 from public.photos where faces_status = 'pending' and kind = 'party' and removed_at is null)
          and exists (select 1 from public.face_refs where embedding is not null))
$$;
revoke all on function public.face_work_waiting() from public, anon, authenticated;

create or replace function public.face_claim(p_selfies integer default 4, p_photos integer default 6)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare s jsonb; p jsonb := '[]'::jsonb;
begin
  insert into public.rostos_vivo (id, seen_at) values (1, now())
  on conflict (id) do update set seen_at = excluded.seen_at;
  with c as (
    select id from public.guests
    where face_status = 'pending' and selfie_path is not null and (face_claimed_at is null or face_claimed_at < now() - interval '5 minutes')
    order by created_at limit p_selfies for update skip locked
  ), u as (
    update public.guests g set face_claimed_at = now() from c where g.id = c.id
    returning g.id, g.selfie_path
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'selfie_path', selfie_path)), '[]'::jsonb) into s from u;
  if exists (select 1 from public.face_refs where embedding is not null) then
    with c as (
      select id from public.photos
      where faces_status = 'pending' and kind = 'party' and removed_at is null
        and (faces_claimed_at is null or faces_claimed_at < now() - interval '5 minutes')
      order by created_at limit p_photos for update skip locked
    ), u as (
      update public.photos ph set faces_claimed_at = now() from c where ph.id = c.id
      returning ph.id, ph.original_path, ph.preview_path
    )
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'original_path', original_path, 'preview_path', preview_path)), '[]'::jsonb) into p from u;
  end if;
  return jsonb_build_object('selfies', s, 'photos', p);
end $function$;

-- the rostos-cron URL is public: a short run only goes to GitHub when there is work waiting
create or replace function public.rostos_allow(p_op text)
returns boolean language plpgsql security definer set search_path = '' as $function$
declare gap interval := case p_op when 'party' then interval '5 hours' when 'drain' then interval '4 minutes' else interval '5 minutes' end;
begin
  perform pg_advisory_xact_lock(hashtext('rostos_dispatch'));
  if p_op = 'drain' and not public.face_work_waiting() then return false; end if;
  if exists (select 1 from public.rostos_dispatch where op = p_op and at > now() - gap) then return false; end if;
  insert into public.rostos_dispatch (op) values (p_op);
  return true;
end $function$;

-- start a worker when work is waiting, no worker visited the queue in the last minute,
-- and none was started in the last 4 minutes (GitHub takes a minute or two to boot one)
create or replace function public.rostos_chamar()
returns text language plpgsql security definer set search_path = '' as $function$
begin
  if not public.face_work_waiting() then return 'vazio'; end if;
  if exists (select 1 from public.rostos_vivo where seen_at > now() - interval '1 minute') then return 'rodando'; end if;
  if exists (select 1 from public.rostos_dispatch where op in ('drain', 'party') and at > now() - interval '4 minutes') then return 'ligando'; end if;
  perform net.http_post('https://optapzbhyhklcirdoyid.supabase.co/functions/v1/rostos-cron?op=drain', '{}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb);
  return 'chamado';
end $function$;
revoke all on function public.rostos_chamar() from public, anon, authenticated;

create or replace function public.rostos_chamar_trg()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.rostos_chamar();
  return null;
end $$;

create or replace trigger photos_rostos_chamar after insert or update of faces_status on public.photos
  for each row when (new.faces_status = 'pending' and new.kind = 'party') execute function public.rostos_chamar_trg();

create or replace trigger guests_rostos_chamar after insert or update of selfie_path, face_status on public.guests
  for each row when (new.face_status = 'pending' and new.selfie_path is not null) execute function public.rostos_chamar_trg();

-- safety net (a photo that arrived while a worker was shutting down, a failed start, re-reads)
select cron.schedule('rostos-chamar', '* * * * *', $$select public.rostos_chamar()$$);

-- the 30-minute runs planned for 06/11 are no longer needed
select cron.unschedule('rostos-fila-liga') where exists (select 1 from cron.job where jobname = 'rostos-fila-liga');
select cron.unschedule('rostos-fila') where exists (select 1 from cron.job where jobname = 'rostos-fila');
