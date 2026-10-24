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

echo "corridas ok"
