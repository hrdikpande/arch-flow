#!/usr/bin/env bash
# Integration harness: rebuilds a scratch database from the real migrations, starts PostgREST
# (the same REST layer Supabase uses), seeds one owner and one unknown number, then runs the
# messaging integration tests against it.
#
# Needs: PostgreSQL 16 (psql, createdb), POSTGREST_BIN (path to the postgrest binary).
# Optional: PG_RUN_AS_POSTGRES=1 when the postgres superuser needs `su postgres` (peer auth).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
DB="${ARCHFLOW_API_DB:-arch_flow_api}"
PORT="${ARCHFLOW_API_PORT:-3401}"
WEB_PORT="${ARCHFLOW_WEB_PORT:-3500}"
: "${POSTGREST_BIN:?Set POSTGREST_BIN to the postgrest binary}"
JWT_SECRET="${ARCHFLOW_JWT_SECRET:-$(openssl rand -base64 48 | tr -d '\n')}"
WORK="$(mktemp -d)"
API_PID=""
trap '[ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null; rm -rf "$WORK"' EXIT

sql() { # sql <file>: run a SQL file as the postgres superuser
  if [ "${PG_RUN_AS_POSTGRES:-}" = "1" ]; then
    su postgres -c "psql -v ON_ERROR_STOP=1 -q $1" < "$2"
  else
    psql -v ON_ERROR_STOP=1 -q "postgresql://postgres@127.0.0.1:5432/$1" -f "$2"
  fi
}
psql_admin() { # psql_admin <sql text>
  if [ "${PG_RUN_AS_POSTGRES:-}" = "1" ]; then su postgres -c "psql -q -d postgres -v ON_ERROR_STOP=1" <<< "$1"
  else psql -q "postgresql://postgres@127.0.0.1:5432/postgres" -v ON_ERROR_STOP=1 <<< "$1"; fi
}

psql_admin "drop database if exists $DB with (force); create database $DB;"

cat "$ROOT/supabase/tests/rls_fixture.sql" > "$WORK/all.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do cat "$f" >> "$WORK/all.sql"; echo ";" >> "$WORK/all.sql"; done
cat "$HERE/roles.sql" >> "$WORK/all.sql"
sql "$DB" "$WORK/all.sql"

cat > "$WORK/pgrst.conf" <<CONF
db-uri = "postgres://authenticator:pgrst-local@127.0.0.1:5432/$DB"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$JWT_SECRET"
server-port = $((PORT + 1))
CONF
"$POSTGREST_BIN" "$WORK/pgrst.conf" > "$WORK/pgrst.log" 2>&1 &
API_PID=$!
node "$HERE/gateway.js" "$PORT" "$((PORT + 1))" &
PROXY_PID=$!
trap 'kill "$API_PID" "$PROXY_PID" 2>/dev/null; rm -rf "$WORK"' EXIT
for _ in $(seq 1 30); do curl -sf -o /dev/null "http://127.0.0.1:$((PORT + 1))/" && break; sleep 1; done

sql "$DB" "$HERE/seed.sql"
sql "$DB" "$HERE/seed-signed-in.sql"

if [ "${ARCHFLOW_KEEP_RUNNING:-}" = "1" ]; then
  echo "API ready on http://127.0.0.1:$PORT (service key secret: JWT_SECRET in ARCHFLOW_JWT_SECRET_FILE)"
  [ -n "${ARCHFLOW_JWT_SECRET_FILE:-}" ] && printf '%s' "$JWT_SECRET" > "$ARCHFLOW_JWT_SECRET_FILE"
  wait "$API_PID"
  exit 0
fi

export ARCHFLOW_API_URL="http://127.0.0.1:$PORT" ARCHFLOW_JWT_SECRET="$JWT_SECRET"
export ARCHFLOW_WHATSAPP_WEB_DIR="$ROOT/apps/whatsapp-web"

cd "$ROOT/packages/messaging"
npx vitest run test/integration
cd "$ROOT/apps/whatsapp-web"
node --test test/wiring.test.js

if [ "${ARCHFLOW_SIGNED_IN:-1}" = "1" ]; then
  # Build the web app against the local API and run the signed-in browser tests.
  SVC_KEY="$(node -e "const c=require('crypto');const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');const h=b({alg:'HS256',typ:'JWT'});const p=b({role:'service_role',iss:'supabase-local',exp:Math.floor(Date.now()/1000)+3600});console.log(h+'.'+p+'.'+c.createHmac('sha256',process.argv[1]).update(h+'.'+p).digest('base64url'))" "$JWT_SECRET")"
  export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$PORT" NEXT_PUBLIC_SUPABASE_ANON_KEY="$SVC_KEY" SUPABASE_URL="http://127.0.0.1:$PORT" SUPABASE_SERVICE_ROLE_KEY="$SVC_KEY"
  export APP_URL="http://127.0.0.1:$WEB_PORT" NEXT_TELEMETRY_DISABLED=1 MESSAGING_TRANSPORT=web CRON_SECRET=harness-cron-secret
  cd "$ROOT"
  npm run build -w @arch-flow/domain >/dev/null && npm run build -w @arch-flow/messaging >/dev/null && npm run build -w @arch-flow/web >/dev/null
  cd "$ROOT/apps/web"
  if curl -s -o /dev/null "http://127.0.0.1:$WEB_PORT/"; then echo "port $WEB_PORT is already in use; stop that server first" >&2; exit 1; fi
  npx next start -p "$WEB_PORT" > "$WORK/next.log" 2>&1 &
  WEB_PID=$!
  trap 'kill "$API_PID" "$PROXY_PID" "$WEB_PID" 2>/dev/null; rm -rf "$WORK"' EXIT
  for _ in $(seq 1 60); do curl -sf -o /dev/null "http://127.0.0.1:$WEB_PORT/login" && break; sleep 1; done
  ARCHFLOW_APP_URL="http://127.0.0.1:$WEB_PORT" ARCHFLOW_API_URL="http://127.0.0.1:$PORT" ARCHFLOW_SERVICE_KEY="$SVC_KEY" \
    npx playwright test -c playwright.signedin.config.ts
fi
