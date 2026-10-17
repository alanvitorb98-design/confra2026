-- Advisor cleanup (17/10): server-only tables say so with a policy, every table has a primary key,
-- foreign keys have indexes, pg_net leaves the public schema, unused phone functions are gone.

-- tables only the server touches: an explicit "nobody from the app" policy instead of none
do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relrowsecurity
      and c.relname not like 'test\_%'
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
  loop
    execute format('create policy so_servidor on public.%I for all to anon, authenticated using (false) with check (false)', t);
  end loop;
end $$;

-- attempt logs get a primary key
alter table public.join_attempts add column if not exists id bigint generated always as identity primary key;
alter table public.admin_attempts add column if not exists id bigint generated always as identity primary key;
alter table public.rostos_dispatch add column if not exists id bigint generated always as identity primary key;

-- foreign keys looked up by guest (save_push keeps each guest's newest 5)
create index if not exists push_subs_guest on public.push_subs (guest_id);
create index if not exists join_keys_guest on public.join_keys (guest_id);
create index if not exists r2_links_guest on public.r2_links (guest_id);

-- replaced by set_reaction (17/10) and never called by the app
drop function if exists public.react(uuid, text, boolean);
drop function if exists public.update_profile(text, text, boolean);

-- pg_net into the extensions schema; its functions stay in the net schema, so callers don't change
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net' and extnamespace = 'public'::regnamespace) then
    drop extension pg_net;
    create extension pg_net with schema extensions;
  end if;
end $$;
