-- Entry by invitation. Two kinds, both optional until the organizer turns on "só com convite":
--   * personal invitations (one link per guest or family, ?i=TOKEN): whoever opens it again on any phone picks
--     their name and is back in the same account, so forgetting the código de volta no longer makes a second
--     guest. A family link has a number of seats.
--   * the event code (?c=CODE) in the printed QR and on the telão, for anyone without a personal link.
-- The join function (service role) checks them; phones never read these tables.
alter table public.event_config add column invite_only boolean default false not null;

create table public.invites (
  id uuid default gen_random_uuid() not null,
  token text not null,
  label text not null,
  seats integer default 1 not null,
  created_at timestamp with time zone default now() not null,
  revoked_at timestamp with time zone
);
alter table public.invites add constraint invites_pkey PRIMARY KEY (id);
alter table public.invites add constraint invites_token_key UNIQUE (token);
alter table public.invites add constraint invites_label_check CHECK (char_length(label) between 1 and 60);
alter table public.invites add constraint invites_seats_check CHECK (seats between 1 and 20);
alter table public.invites enable row level security;
revoke all on public.invites from public, anon, authenticated;

alter table public.guests add column invite_id uuid;
alter table public.guests add constraint guests_invite_id_fkey FOREIGN KEY (invite_id) REFERENCES public.invites(id) ON DELETE SET NULL;
create index guests_invite_id_idx on public.guests using btree (invite_id) where invite_id is not null;

-- the people who already came in with an invitation, for the "who are you?" list
CREATE OR REPLACE FUNCTION public.invite_peek(p_token text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'id', i.id, 'label', i.label, 'seats', i.seats, 'revoked', i.revoked_at is not null,
    'people', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name) order by g.created_at)
                        from public.guests g where g.invite_id = i.id), '[]'::jsonb)
  )
  from public.invites i where i.token = upper(regexp_replace(coalesce(p_token, ''), '[^A-Za-z0-9]', '', 'g'));
$function$
;
revoke all on function public.invite_peek(text) from public, anon, authenticated;
grant execute on function public.invite_peek(text) to service_role;

-- someone with the same name (ignoring case, accents and extra spaces) is already in
CREATE OR REPLACE FUNCTION public.guest_name_taken(p_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.guests
    where lower(extensions.unaccent(regexp_replace(trim(name), '\s+', ' ', 'g')))
        = lower(extensions.unaccent(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g')))
  );
$function$
;
revoke all on function public.guest_name_taken(text) from public, anon, authenticated;
grant execute on function public.guest_name_taken(text) to service_role;

-- a guest's código de volta, made on first ask (the guest's own, or the organizer's for that guest)
CREATE OR REPLACE FUNCTION public.return_code_for(g uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c text; abc constant text := 'ACDEFGHJKMNPQRTUVWXY3479';
begin
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
end $function$
;
revoke all on function public.return_code_for(uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_return_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare g uuid := public.my_guest();
begin
  if g is null then raise exception 'faça login'; end if;
  return public.return_code_for(g);
end $function$
;

-- organizer: the invitations with who came in on each
CREATE OR REPLACE FUNCTION public.admin_invites()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', i.id, 'token', i.token, 'label', i.label, 'seats', i.seats, 'revoked', i.revoked_at is not null,
      'people', coalesce((select jsonb_agg(g.name order by g.created_at) from public.guests g where g.invite_id = i.id), '[]'::jsonb)
    ) order by i.created_at, i.label)
    from public.invites i
  ), '[]'::jsonb);
end $function$
;

-- organizer: one invitation per line, "Família Souza; 4" for a family of four (a tab works too, as pasted
-- from a spreadsheet). Returns how many were made.
CREATE OR REPLACE FUNCTION public.admin_invites_add(p_lines text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare line text; m text[]; lbl text; n int; made int := 0; t text; abc constant text := 'ACDEFGHJKMNPQRTUVWXY3479';
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  if (select count(*) from regexp_split_to_table(coalesce(p_lines, ''), E'\n') x where trim(x) <> '') > 500 then
    raise exception 'no máximo 500 de uma vez';
  end if;
  for line in select trim(x) from regexp_split_to_table(coalesce(p_lines, ''), E'\n') x where trim(x) <> '' loop
    m := regexp_match(line, '^(.*?)\s*[;\t]\s*(\d{1,2})$');
    lbl := left(trim(coalesce(m[1], line)), 60);
    n := least(greatest(coalesce(m[2]::int, 1), 1), 20);
    continue when lbl = '';
    if (select count(*) from public.invites) >= 3000 then raise exception 'limite de convites'; end if;
    loop
      select string_agg(substr(abc, 1 + get_byte(b, i) % length(abc), 1), '' order by i) into t
      from (select extensions.gen_random_bytes(10) as b) r, generate_series(0, 9) i;
      begin
        insert into public.invites (token, label, seats) values (t, lbl, n);
        exit;
      exception when unique_violation then null;
      end;
    end loop;
    made := made + 1;
  end loop;
  return made;
end $function$
;

-- organizer: rename, change seats, cancel or bring back an invitation (a cancelled link stops working, the
-- people who came in with it stay)
CREATE OR REPLACE FUNCTION public.admin_invite_set(p_id uuid, p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  update public.invites set
    label = coalesce(nullif(left(trim(p->>'label'), 60), ''), label),
    seats = case when p ? 'seats' then least(greatest((p->>'seats')::int, 1), 20) else seats end,
    revoked_at = case when p ? 'revoked' then (case when (p->>'revoked')::boolean then coalesce(revoked_at, now()) end) else revoked_at end
  where id = p_id;
end $function$
;

-- organizer: find a guest by name to show their QR de volta
CREATE OR REPLACE FUNCTION public.admin_find_guests(p_q text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q text := lower(extensions.unaccent(trim(coalesce(p_q, ''))));
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  if char_length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'name') from (
      select jsonb_build_object(
        'id', g.id, 'name', g.name, 'instagram', g.instagram, 'created_at', g.created_at,
        'invite', (select i.label from public.invites i where i.id = g.invite_id),
        'photos', (select count(*) from public.photos p where p.guest_id = g.id and p.removed_at is null)
      ) x
      from public.guests g
      where lower(extensions.unaccent(g.name)) like '%' || q || '%'
         or lower(coalesce(g.instagram, '')) like '%' || q || '%'
      order by g.name limit 20
    ) s
  ), '[]'::jsonb);
end $function$
;

-- organizer: that guest's código de volta, for the QR shown face to face at the party
CREATE OR REPLACE FUNCTION public.admin_return_code(p_guest uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then raise exception 'só organizador'; end if;
  if not exists (select 1 from public.guests where id = p_guest) then raise exception 'convidado não encontrado'; end if;
  return public.return_code_for(p_guest);
end $function$
;

revoke all on function public.admin_invites() from public, anon, authenticated;
revoke all on function public.admin_invites_add(text) from public, anon, authenticated;
revoke all on function public.admin_invite_set(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.admin_find_guests(text) from public, anon, authenticated;
revoke all on function public.admin_return_code(uuid) from public, anon, authenticated;
grant execute on function public.admin_invites() to authenticated;
grant execute on function public.admin_invites_add(text) to authenticated;
grant execute on function public.admin_invite_set(uuid, jsonb) to authenticated;
grant execute on function public.admin_find_guests(text) to authenticated;
grant execute on function public.admin_return_code(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_event(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    invite_only = coalesce((p->>'invite_only')::boolean, invite_only),
    gen_missions = coalesce((p->>'gen_missions')::boolean, gen_missions),
    -- greatest/least skip nulls, so a missing field must keep the old value explicitly
    gen_max_people = case when p ? 'gen_max_people' then least(greatest((p->>'gen_max_people')::int, 1), 6) else gen_max_people end,
    gen_min_guests = case when p ? 'gen_min_guests' then least(greatest((p->>'gen_min_guests')::int, 2), 500) else gen_min_guests end,
    updated_at = now()
  where id;
end $function$
;

-- the opening screens need to know whether the door is open to anyone
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
    'invite_only', c.invite_only
  );
end $function$
;
