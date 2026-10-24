-- Race tests (supabase/tests/corrida.sh) found one more: wrong organizer codes sent all at once each counted the
-- tries before any of them was written down, so a burst got past the 5 an hour. Guesses from one login now wait
-- for each other.
CREATE OR REPLACE FUNCTION public.claim_admin(p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s public.event_secret;
begin
  if auth.uid() is null then return false; end if;
  -- one guess at a time per login: guesses sent all at once each counted before the others were written down
  perform pg_advisory_xact_lock(hashtext('claim_admin:' || auth.uid()));
  if (select count(*) from public.admin_attempts where user_id = auth.uid() and at > now() - interval '1 hour') >= 5 then
    raise exception 'muitas tentativas, tenta de novo daqui a pouco';
  end if;
  select * into s from public.event_secret;
  if s.admin_code is null or upper(trim(coalesce(p_code, ''))) <> s.admin_code then
    insert into public.admin_attempts (user_id) values (auth.uid());
    return false;
  end if;
  update public.guests set is_admin = true where user_id = auth.uid();
  return found;
end $function$
;
