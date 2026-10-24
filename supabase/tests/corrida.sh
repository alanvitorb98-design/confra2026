#!/usr/bin/env bash
# Race tests: many phones doing the same thing at the same instant. Each case starts several database sessions
# at once, holds each one open a moment so they really overlap, then checks what was left.
# Usage: bash supabase/tests/corrida.sh [database url]
set -euo pipefail
DB="${1:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
q() { psql "$DB" -v ON_ERROR_STOP=1 -qAtc "$1"; }
fail() { echo "FALHOU: $1"; exit 1; }
together() { # run the same SQL in N sessions at once (errors are expected: they are the ones turned away)
  local n=$1 sql=$2
  for i in $(seq "$n"); do psql "$DB" -qAt -c "begin; ${sql//\{i\}/$i}; select pg_sleep(0.3); commit;" >/dev/null 2>&1 & done
  wait
}

echo "== convite de família: 12 pessoas no mesmo link ao mesmo tempo, 3 lugares"
inv=$(q "insert into public.invites (token, label, seats) values ('CORRIDA001', 'Corrida', 3) returning id")
together 12 "insert into public.guests (name, invite_id) values ('Corrida {i}', '$inv')"
n=$(q "select count(*) from public.guests where invite_id = '$inv'")
q "delete from public.guests where invite_id = '$inv'; delete from public.invites where id = '$inv'"
[ "$n" = 3 ] || fail "entraram $n pessoas num convite de 3 lugares"

ANA=00000000-0000-0000-0000-00000000000a
ANA_G=10000000-0000-0000-0000-00000000000a
as_ana="select public.test_as('$ANA')"

echo "== código do organizador: 12 chutes errados ao mesmo tempo, o limite é 5 por hora"
q "update public.event_secret set admin_code = 'CERTO123'"
together 12 "$as_ana; select public.claim_admin('ERRADO{i}')"
n=$(q "select count(*) from public.admin_attempts where user_id = '$ANA'")
q "delete from public.admin_attempts where user_id = '$ANA'; update public.event_secret set admin_code = null"
[ "$n" -le 5 ] || fail "$n chutes contados num limite de 5"
[ "$(q "select is_admin from public.guests where id = '$ANA_G'")" = f ] || fail "chute errado virou organizador"

echo "== a mesma foto enviada 8 vezes ao mesmo tempo (o celular tentou de novo): uma foto só"
id=$(q "select gen_random_uuid()")
together 8 "$as_ana; select public.send_photo('$id', 'party', 'oi', 'classic', 0, 'party/$ANA_G/$id.jpg', 'party/$ANA_G/$id-p.jpg', 100, null)"
n=$(q "select count(*) from public.photos where id = '$id'")
[ "$n" = 1 ] || fail "a foto entrou $n vezes"

echo "== a mesma reação tocada 8 vezes ao mesmo tempo: uma reação"
together 8 "$as_ana; select public.set_reaction('$id', '🔥', true)"
n=$(q "select count(*) from public.reactions where photo_id = '$id' and guest_id = '$ANA_G' and active")
q "delete from public.reactions where photo_id = '$id'; delete from public.photos where id = '$id'"
[ "$n" = 1 ] || fail "a reação contou $n vezes"

echo "== missão com pessoas pedida 8 vezes ao mesmo tempo (app aberto em dois celulares): uma missão"
was=$(q "select format('gen_missions = %L, gen_min_guests = %s, gen_max_people = %s', gen_missions, gen_min_guests, gen_max_people) from public.event_config")
q "update public.event_config set gen_missions = true, gen_min_guests = 2, gen_max_people = 4"
q "update public.guests set face_opt_in = true where name = 'Bia'"
q "insert into public.face_refs (guest_id, embedding) values ('10000000-0000-0000-0000-00000000000b', array_fill(0.1::real, array[512])::vector)"
together 8 "$as_ana; select public.people_mission()"
n=$(q "select count(*) from public.missions where owner = '$ANA_G' and active")
q "delete from public.missions where owner = '$ANA_G'; delete from public.face_refs where guest_id = '10000000-0000-0000-0000-00000000000b'"
q "update public.guests set face_opt_in = false where name = 'Bia'; update public.event_config set $was"
[ "$n" = 1 ] || fail "ganhou $n missões abertas"

echo "corridas ok"
