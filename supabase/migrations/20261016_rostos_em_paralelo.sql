-- Several face servers at once without reading the same photo twice: the queue hands each job to one
-- server (claimed for 5 minutes; a server that dies just lets it go back to the queue).
alter table public.photos add column if not exists faces_claimed_at timestamptz;
alter table public.guests add column if not exists face_claimed_at timestamptz;

create or replace function public.face_claim(p_selfies int default 4, p_photos int default 6)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare s jsonb; p jsonb := '[]'::jsonb;
begin
  with c as (
    select id from public.guests
    where face_status = 'pending' and selfie_path is not null and (face_claimed_at is null or face_claimed_at < now() - interval '5 minutes')
    order by created_at limit p_selfies for update skip locked
  ), u as (
    update public.guests g set face_claimed_at = now() from c where g.id = c.id
    returning g.id, g.selfie_path
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'selfie_path', selfie_path)), '[]'::jsonb) into s from u;
  -- photos wait until someone has a selfie to look for
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
end $$;
revoke all on function public.face_claim(int, int) from public, anon, authenticated;
