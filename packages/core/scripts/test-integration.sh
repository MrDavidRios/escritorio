#!/bin/sh
# Runs the API integration tests against the local Supabase stack. Start it
# first from the repo root: `bun run db:start` (and `bun run db:reset` for a
# fresh database). Set SUPABASE_INTEGRATION_URL / _ANON_KEY to point elsewhere.
set -e
cd "$(dirname "$0")/.."
eval "$(cd ../.. && bunx supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY)=')"
export SUPABASE_INTEGRATION_URL="${SUPABASE_INTEGRATION_URL:-$API_URL}"
export SUPABASE_INTEGRATION_ANON_KEY="${SUPABASE_INTEGRATION_ANON_KEY:-$ANON_KEY}"

# Without these the test file skips itself and vitest exits 0: a green run
# that checked nothing. Fail loudly instead.
if [ -z "$SUPABASE_INTEGRATION_URL" ] || [ -z "$SUPABASE_INTEGRATION_ANON_KEY" ]; then
  echo "Supabase stack not found. Start it from the repo root: bun run db:start" >&2
  exit 1
fi

exec vitest run api.integration
