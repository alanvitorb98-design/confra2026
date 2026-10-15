-- Código de volta: a short code per guest to get back into the same account on another phone or browser
-- (or after the browser cleared its data), instead of joining again as a second person.
-- Only the guest themselves reads it (my_return_code); the join function checks it with the service key.
create table if not exists public.guest_codes (
  guest_id uuid primary key references public.guests(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.guest_codes enable row level security;
revoke all on public.guest_codes from anon, authenticated;

create or replace function public.my_return_code()
returns text language plpgsql security definer set search_path to '' as $$
declare g uuid := public.my_guest(); c text; abc constant text := 'ACDEFGHJKMNPQRTUVWXY3479';
begin
  if g is null then raise exception 'faça login'; end if;
  select code into c from public.guest_codes where guest_id = g;
  while c is null loop
    select string_agg(substr(abc, 1 + get_byte(b, i) % length(abc), 1), '' order by i) into c
    from (select extensions.gen_random_bytes(6) as b) r, generate_series(0, 5) i;
    begin
      insert into public.guest_codes (guest_id, code) values (g, c);
    exception when unique_violation then
      c := null;
      select code into c from public.guest_codes where guest_id = g;
    end;
  end loop;
  return c;
end $$;

revoke all on function public.my_return_code() from public, anon;
grant execute on function public.my_return_code() to authenticated;
