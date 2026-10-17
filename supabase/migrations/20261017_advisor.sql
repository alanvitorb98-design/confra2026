-- Security Advisor clean-up: the two helpers that build missions with people get a fixed search_path, and
-- trigger functions are no longer offered to phones as callable endpoints (they only ever run as triggers,
-- which does not need that grant).
alter function public.people_points(integer) set search_path = '';
alter function public.people_title(text[]) set search_path = '';
revoke execute on function public.mission_verdict(), public.photo_store(), public.rostos_chamar_trg()
  from public, anon, authenticated;
