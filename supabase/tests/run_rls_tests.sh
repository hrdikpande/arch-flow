#!/usr/bin/env bash
# Runs every migration and the RLS tests on a scratch PostgreSQL database.
# Usage: DB=arch_flow_rls PGUSER=postgres tests/run_rls_tests.sh   (needs psql on PATH)
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB="${DB:-arch_flow_rls}"
PSQL=(psql -v ON_ERROR_STOP=1 -q "$DB")
dropdb --if-exists "$DB" 2>/dev/null || true
createdb "$DB"
"${PSQL[@]}" -f "$DIR/tests/rls_fixture.sql"
for file in "$DIR"/migrations/*.sql; do
  echo "applying $(basename "$file")"
  "${PSQL[@]}" -f "$file"
done
"${PSQL[@]}" -f "$DIR/tests/rls_policy_tests.sql" 2>&1 | tee /dev/stderr | grep -q "RLS TESTS PASSED"
echo "RLS suite passed against $DB"
