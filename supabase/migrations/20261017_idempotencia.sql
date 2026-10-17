-- Doing the same thing twice gives the same result: a sign-up sent again after its answer was lost, and a
-- reaction sent again, or answered out of order.

-- Each sign-up carries a key made on the phone before the first try; trying again with it signs into the
-- guest already made instead of making a second one. Only the join function reads it (no grants).
create table if not exists public.join_keys (
  key uuid primary key,
  guest_id uuid references public.guests(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.join_keys enable row level security;
revoke all on public.join_keys from public, anon, authenticated;

-- The reaction as the phone wants it to end up (on or off), not "flip it": a retry or two answers arriving
-- out of order can no longer undo the tap.
create or replace function public.set_reaction(p_photo uuid, p_emoji text, p_active boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare g uuid := public.my_guest();
begin
  if g is null then raise exception 'convidado não encontrado'; end if;
  insert into public.reactions as r (photo_id, guest_id, emoji, active) values (p_photo, g, p_emoji, p_active)
  on conflict (photo_id, guest_id, emoji) do update set active = excluded.active, created_at = now()
  where r.active is distinct from excluded.active;
  return p_active;
end $$;
revoke all on function public.set_reaction(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.set_reaction(uuid, text, boolean) to authenticated;
