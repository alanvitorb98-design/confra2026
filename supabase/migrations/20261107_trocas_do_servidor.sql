-- 07/11: the app had the 3 swaps of the mission with people written in it; it now reads gen_swaps from here.
create or replace function public.event_public(p_code text default null)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare c public.event_config;
begin
  select * into c from public.event_config;
  return jsonb_build_object(
    'app_opens', c.app_opens, 'party_starts', c.party_starts, 'party_ends', c.party_ends,
    'look_opens', c.look_opens, 'look_closes', c.look_closes, 'test_mode', c.test_mode,
    'place', c.place, 'address', c.address, 'maps_url', c.maps_url, 'lat', c.lat, 'lng', c.lng,
    'invite_only', c.invite_only, 'faces_on', c.faces_on, 'missions_on', c.missions_on,
    'ranking_on', c.ranking_on, 'swaps', c.gen_swaps, 'now', now()
  );
end $$;
