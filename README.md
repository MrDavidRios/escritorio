# Escritorio

A Quizlet-like flashcard study app for Spanish learning. Each card shows an image and an optional
hint; you type the answer. Study sets are created, saved, and edited by
signed-in users, backed by Supabase (Postgres + Auth + Storage) and deployed
as a static site to GitHub Pages.

## Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui (Radix UI)
- TanStack Query
- react-router-dom (`HashRouter`, for GitHub Pages compatibility)
- Supabase JS client

## Local development

1. Copy `.env.local.example` to `.env.local` and fill in your Supabase
   project's URL and anon key.
2. `bun install`
3. `bun run dev`

## Scripts

- `bun run dev` — start the dev server
- `bun run build` — typecheck and build for production
- `bun run test` — run the unit test suite (Vitest)
- `bun run lint` — lint with oxlint
- `bun run format` — format with Prettier
- `bun run preview` — preview the production build locally
- `bun run db:start` / `db:stop` — start/stop a local Supabase stack (needs Docker)
- `bun run db:reset` — rebuild the local database from every migration, then seed it
- `bun run db:status` — print the local stack's URLs and keys

## Database migrations

Migrations live in `supabase/migrations/`. The Supabase GitHub integration
checks them on every PR ("Supabase Preview") and applies them to production on
merge to `develop` — **never run a migration by hand in the SQL editor**, or the
integration will try to apply it again and fail.

## Edge Functions

`supabase/functions/` holds Supabase Edge Functions (Deno). They're deployed by
`.github/workflows/deploy-functions.yml` on merge to `develop`, not by the Supabase
GitHub integration (it only deploys functions declared in a committed `config.toml`,
which we don't commit).

One-time setup:

- GitHub repo secrets `SUPABASE_ACCESS_TOKEN` (a Supabase personal access token) and
  `SUPABASE_PROJECT_REF`.
- The TypeSafe key as a function secret: `bunx supabase secrets set TYPESAFE_API_KEY=… --project-ref <ref>`
  (or Dashboard → Edge Functions → Secrets). It never goes in GitHub, and never under a
  `VITE_` name (Vite would bundle it into the frontend).

Locally, all secrets live in the root `.env.local` (git-ignored; see `.env.local.example`).
Add `TYPESAFE_API_KEY=…` there and run `bun run functions:serve` alongside
`bun run db:start`. Tests: `deno test --no-lock supabase/functions/grade-phrase/`.

To try a migration locally first:

1. Start Docker, then `bun run db:start`. The first run downloads the
   Supabase images and prints a local API URL and anon key.
2. Point `.env.local` at the local stack — `VITE_SUPABASE_URL=http://127.0.0.1:54321`
   and `VITE_SUPABASE_ANON_KEY` from the output (`bun run db:status` reprints
   it) — then `bun run dev`. Sign up with any email; local auth needs no
   confirmation. Google sign-in isn't configured locally.
3. Add the new migration file and run `bun run db:reset`, which replays every
   migration on a fresh database and loads `supabase/data/*.sql` as seed data.
   The local Studio at http://127.0.0.1:54323 lets you inspect the result.

Local CLI settings live in `supabase/config.local.toml`; the `db:*` scripts copy
it to `supabase/config.toml`, which is gitignored. Don't commit a
`config.toml`: the GitHub integration would apply its settings (auth site URL,
providers, …) to the production project.
