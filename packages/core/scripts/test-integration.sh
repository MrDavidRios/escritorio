#!/bin/sh
# Runs the API integration tests against the local Supabase stack. Start it
# first from the repo root: `bun run db:start` (and `bun run db:reset` for a
# fresh database). Set SUPABASE_INTEGRATION_URL / _ANON_KEY to point elsewhere.
set -e
cd "$(dirname "$0")/.."
eval "$(cd ../.. && bunx supabase status -o env | grep -E '^(API_URL|ANON_KEY)=')"
SUPABASE_INTEGRATION_URL="${SUPABASE_INTEGRATION_URL:-$API_URL}" \
  SUPABASE_INTEGRATION_ANON_KEY="${SUPABASE_INTEGRATION_ANON_KEY:-$ANON_KEY}" \
  exec vitest run api.integration
