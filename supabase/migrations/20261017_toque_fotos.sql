-- Only a change a phone shows moves photos.updated_at, which is what phones ask "what changed since".
-- The face server's bookkeeping (rescan, the time it took a photo) does not: one late selfie marks every
-- done photo for a rescan, and moving updated_at on thousands of rows at once made every phone re-read them.
create or replace function public.photos_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (to_jsonb(new) - 'rescan' - 'faces_claimed_at' - 'updated_at')
     is distinct from (to_jsonb(old) - 'rescan' - 'faces_claimed_at' - 'updated_at') then
    new.updated_at := clock_timestamp();
  end if;
  return new;
end $$;
create or replace trigger photos_touch before update on public.photos for each row execute function public.photos_touch();
