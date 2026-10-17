-- Fourth core review: less work per nudge, and nothing granted that nobody uses.

-- Missions say when they last changed, so phones read only those after a nudge, not every mission of the
-- party again (each guest's missions with people made every phone read them all, over and over).
alter table public.missions add column if not exists updated_at timestamptz not null default now();
create index if not exists missions_updated_at on public.missions (updated_at);
create or replace trigger missions_touch before update on public.missions
for each row execute function public.touch_updated();

-- Reminders before the party (no guest yet) share one cap, so a flood of made-up sign-ups can no longer
-- take every place; a guest's own phones are kept to the newest 5 instead, and never hit that cap.
create or replace function public.save_push(p_code text, p_endpoint text, p_p256dh text, p_auth text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare g uuid := public.my_guest();
begin
  if p_endpoint !~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]*\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]*\.notify\.windows\.com|[a-z0-9.-]*\.push\.samsungosp\.com)/'
     or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'inscrição inválida';
  end if;
  if g is null then
    if (select count(*) from public.push_subs where removed_at is null and guest_id is null) >= 3000
       and not exists (select 1 from public.push_subs where endpoint = p_endpoint) then
      raise exception 'limite';
    end if;
  else
    update public.push_subs set removed_at = now()
    where endpoint in (
      select endpoint from public.push_subs
      where guest_id = g and removed_at is null and endpoint <> p_endpoint
      order by coalesce(last_ok, created_at) desc offset 4
    );
  end if;
  insert into public.push_subs (endpoint, p256dh, auth, guest_id) values (p_endpoint, p_p256dh, p_auth, g)
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, removed_at = null,
    guest_id = coalesce(excluded.guest_id, public.push_subs.guest_id);
  return true;
end $$;
revoke all on function public.save_push(text, text, text, text) from public, anon, authenticated;
grant execute on function public.save_push(text, text, text, text) to anon, authenticated;

-- Grants nobody uses: the phones only read these tables (row rules decide what), never change them.
revoke all on public.admin_attempts, public.rostos_dispatch from anon, authenticated;
revoke references, trigger, truncate on public.event_config, public.guests, public.missions, public.photo_faces,
  public.photos, public.reactions from anon, authenticated;
revoke execute on function public.people_points(integer), public.people_title(text[]) from public, anon;

-- Phones hear about changes by the "live" nudge only: the tables no longer stream every change to the
-- realtime server for nobody.
alter publication supabase_realtime drop table public.event_config, public.guests, public.missions,
  public.photo_faces, public.photo_spots, public.photos, public.reactions;
