-- The face data goes after the party, as the terms promise ("é apagada depois da festa"), without anyone having
-- to remember: a week after the party ends (late photos are still read in the first 3 days) the face signatures,
-- the face numbers of every photo and the selfies are deleted and recognition is switched off. The selfie files
-- (and the 1600px copies the reader never got to) wait in apagar_arquivos for the r2 function (op=forget) to
-- delete them from the bucket, once a day. A guest leaving the recognition has their selfie file deleted too.
create table public.apagar_arquivos (
  path text not null,
  at timestamp with time zone default now() not null
);
alter table public.apagar_arquivos add constraint apagar_arquivos_pkey PRIMARY KEY (path);
alter table public.apagar_arquivos enable row level security;
create policy so_servidor on public.apagar_arquivos for all to anon, authenticated using (false) with check (false);
revoke all on public.apagar_arquivos from public, anon, authenticated;

alter table public.event_config add column faces_forgotten_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.forget_faces(p_off boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.apagar_arquivos (path)
  select selfie_path from public.guests where selfie_path is not null
  union
  select regexp_replace(original_path, '\.[^./]+$', '') || '-f.jpg' from public.photos
  where kind = 'party' and faces_status in ('pending', 'failed')
  on conflict (path) do nothing;
  update public.face_refs set embedding = null, updated_at = now() where embedding is not null;
  update public.face_extra set embedding = null where embedding is not null;
  delete from public.face_vectors;
  update public.photo_faces set score = -1 where score > 0 and by_hand is null;
  update public.photo_spots set guest_id = null where guest_id is not null and not by_hand;
  update public.guests set face_status = 'none', selfie_path = null where face_status <> 'none' or selfie_path is not null;
  update public.photos set faces_status = 'skip' where faces_status in ('pending', 'failed');
  if p_off then update public.event_config set faces_on = false, faces_forgotten_at = now() where id; end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.forget_faces_when_due()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists (select 1 from public.event_config where party_ends < now() - interval '7 days' and faces_forgotten_at is null) then
    perform public.forget_faces(true);
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_wipe_faces()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  perform public.forget_faces(false);
end $function$
;

CREATE OR REPLACE FUNCTION public.face_opt_out()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g uuid;
begin
  g := public.my_guest();
  insert into public.apagar_arquivos (path)
  select selfie_path from public.guests where id = g and selfie_path is not null
  on conflict (path) do nothing;
  update public.guests set face_opt_in = false, face_status = 'none', selfie_path = null where id = g;
  update public.face_refs set embedding = null, updated_at = now() where guest_id = g;
  update public.face_extra set embedding = null where guest_id = g and embedding is not null;
  update public.photo_faces set score = -1 where guest_id = g and by_hand is null;
  update public.photo_spots set guest_id = null where guest_id = g and not by_hand;
end $function$
;

revoke all on function public.forget_faces(boolean) from public, anon, authenticated;
revoke all on function public.forget_faces_when_due() from public, anon, authenticated;

select cron.schedule('esquecer-rostos', '41 6 * * *', $c$select public.forget_faces_when_due(); select net.http_post('https://optapzbhyhklcirdoyid.supabase.co/functions/v1/r2?op=forget', '{}'::jsonb, headers := '{"Content-Type":"application/json"}'::jsonb)$c$);
