-- Two people opening the same family link at the same moment could both see a free seat and both come in, one more
-- than the seats. The seat is now taken inside the database: the invitation row is locked while its guests are
-- counted, so the second one waits for the first and sees the real count. The join function reads 'cheio' or
-- 'convite' from the error and answers the phone as before.
CREATE OR REPLACE FUNCTION public.guests_invite_seat()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s int; gone timestamptz;
begin
  if new.invite_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.invite_id is not distinct from old.invite_id then return new; end if;
  select seats, revoked_at into s, gone from public.invites where id = new.invite_id for update;
  if not found or gone is not null then raise exception 'convite'; end if;
  if (select count(*) from public.guests where invite_id = new.invite_id and id <> new.id) >= s then
    raise exception 'cheio';
  end if;
  return new;
end $function$
;
revoke all on function public.guests_invite_seat() from public, anon, authenticated;

CREATE TRIGGER guests_invite_seat BEFORE INSERT OR UPDATE OF invite_id ON public.guests FOR EACH ROW EXECUTE FUNCTION guests_invite_seat();
