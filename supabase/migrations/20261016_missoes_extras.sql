-- The organizer can turn the missions with people on or off and set how big the groups get, from the panel.
create or replace function public.admin_update_event(p jsonb)
returns void language plpgsql security definer set search_path = '' as $function$
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  if coalesce(p->>'maps_url', '') <> '' and p->>'maps_url' !~ '^https://' then
    raise exception 'o link do mapa precisa começar com https://';
  end if;
  update public.event_config set
    app_opens = coalesce((p->>'app_opens')::timestamptz, app_opens),
    party_starts = coalesce((p->>'party_starts')::timestamptz, party_starts),
    party_ends = coalesce((p->>'party_ends')::timestamptz, party_ends),
    look_opens = coalesce((p->>'look_opens')::timestamptz, look_opens),
    look_closes = coalesce((p->>'look_closes')::timestamptz, look_closes),
    place = coalesce(left(p->>'place', 80), place),
    address = coalesce(left(p->>'address', 160), address),
    maps_url = coalesce(left(p->>'maps_url', 300), maps_url),
    lat = case when p ? 'lat' then (p->>'lat')::double precision else lat end,
    lng = case when p ? 'lng' then (p->>'lng')::double precision else lng end,
    test_mode = coalesce((p->>'test_mode')::boolean, test_mode),
    gen_missions = coalesce((p->>'gen_missions')::boolean, gen_missions),
    gen_max_people = coalesce(least(greatest((p->>'gen_max_people')::int, 1), 6), gen_max_people),
    gen_min_guests = coalesce(least(greatest((p->>'gen_min_guests')::int, 2), 500), gen_min_guests),
    updated_at = now()
  where id;
end $function$;

-- missions the organizer writes are extras: worth a little, so the ranking follows the checked missions with people
alter table public.missions alter column points set default 15;
