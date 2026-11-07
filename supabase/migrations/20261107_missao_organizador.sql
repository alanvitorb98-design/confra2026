-- 07/11: a guest the recognition misses (a hard selfie) left the mission stuck with no way out but SQL.
-- A tag by hand from an organizer now counts for the mission; a guest's own tag still does not.
create or replace function public.mission_org_tag(p_photo uuid, p_guest uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.photo_spots s join public.guests a on a.id = s.tagged_by
                 where s.photo_id = p_photo and s.guest_id = p_guest and s.by_hand and not s.removed and a.is_admin)
$$;
revoke all on function public.mission_org_tag(uuid, uuid) from public, anon, authenticated;

create or replace function public.mission_verdict()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare t text; tg uuid[]; own uuid;
begin
  if new.mission_id is null then new.mission_ok := null; return new; end if;
  select nullif(trim(target), ''), targets, owner into t, tg, own from public.missions where id = new.mission_id;
  if tg is not null then
    if own is distinct from new.guest_id then new.mission_ok := false;
    elsif new.faces_status in ('done', 'failed') then
      -- found by the recognition, or tagged by hand by an organizer (a guest's own tag never counts)
      new.mission_ok := not exists (
        select 1 from unnest(tg) x(id)
        where not exists (select 1 from public.photo_faces pf where pf.photo_id = new.id and pf.guest_id = x.id and pf.score > 0 and pf.by_hand is null and new.faces_status = 'done')
          and not public.mission_org_tag(new.id, x.id)
      );
    else new.mission_ok := null;
    end if;
    return new;
  end if;
  if t is null then new.mission_ok := true; return new; end if;
  if new.faces_status = 'done' and exists (
      select 1 from public.photo_faces pf join public.guests g on g.id = pf.guest_id
      where pf.photo_id = new.id and pf.score > 0 and pf.by_hand is null and pf.guest_id <> new.guest_id and public.name_matches(g.name, t)) then
    new.mission_ok := true;
  elsif new.faces_status in ('done', 'failed') and exists (
      select 1 from public.photo_spots s join public.guests g on g.id = s.guest_id
      where s.photo_id = new.id and s.guest_id <> new.guest_id and public.mission_org_tag(new.id, s.guest_id) and public.name_matches(g.name, t)) then
    new.mission_ok := true;
  elsif new.faces_status in ('done', 'failed') or not public.target_has_face(t, new.guest_id) then
    new.mission_ok := false;
  else
    new.mission_ok := null;
  end if;
  return new;
end $$;
