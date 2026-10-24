-- The server's clock goes with the party times: a phone set minutes or hours off would show the wrong countdown,
-- open or close the camera at the wrong moment, and stamp its photos with a time the server refuses (more than
-- five minutes ahead). The app measures the difference once per answer and uses the server's time.
CREATE OR REPLACE FUNCTION public.event_public(p_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c public.event_config;
begin
  select * into c from public.event_config;
  return jsonb_build_object(
    'app_opens', c.app_opens, 'party_starts', c.party_starts, 'party_ends', c.party_ends,
    'look_opens', c.look_opens, 'look_closes', c.look_closes, 'test_mode', c.test_mode,
    'place', c.place, 'address', c.address, 'maps_url', c.maps_url, 'lat', c.lat, 'lng', c.lng,
    'invite_only', c.invite_only, 'now', now()
  );
end $function$
;
