-- Progress of my selfie's analysis, for the bar on the profile: whether the face server is on,
-- whether it already took my selfie, and how many selfies are ahead of mine.

-- a new selfie starts with no claim, so "reading" only means this selfie
create or replace function public.set_selfie(p_path text)
returns void language plpgsql security definer set search_path = '' as $function$
declare g uuid;
begin
  g := public.my_guest();
  if g is null or p_path not like 'selfie/' || g || '/%' then raise exception 'selfie inválida'; end if;
  update public.guests set selfie_path = p_path, face_status = 'pending', face_opt_in = true, face_claimed_at = null where id = g;
end $function$;

create or replace function public.my_face_progress()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'status', g.face_status,
    'reading', g.face_claimed_at is not null,
    'worker', exists (select 1 from public.rostos_vivo where seen_at > now() - interval '40 seconds'),
    'ahead', (select count(*) from public.guests o
              where o.face_status = 'pending' and o.selfie_path is not null and o.face_claimed_at is null
                and o.created_at < g.created_at and o.id <> g.id))
  from public.guests g where g.id = public.my_guest()
$$;
revoke all on function public.my_face_progress() from public, anon;
grant execute on function public.my_face_progress() to authenticated;
