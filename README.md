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

## Repo layout

- `apps/web` — the Vite web app (deployed to GitHub Pages)
- `apps/mobile` — the Expo iOS app (`@escritorio/mobile`)
- `packages/core` — `@escritorio/core`: types, grading, study modes,
  schemas, dictionary API and query keys shared by every app
- `supabase/` — migrations, seed data and local stack config

## Local development

1. Copy `apps/web/.env.local.example` to `apps/web/.env.local` and fill
   in your Supabase project's URL and anon key.
2. `bun install`
3. `bun run dev`

## Mobile app (iOS)

1. Put `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the repo-root `.env.local`
   (the app falls back to `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` there).
2. `bun install`, then `bun run dev:mobile` and scan the QR code with the Expo Go app on your iPhone.
3. For Google sign-in, add `escritorio://**` (builds) and `exp://**` (Expo Go) to
   the hosted project's redirect URLs (Supabase dashboard → Authentication →
   URL Configuration). A mismatch sends you to the Site URL instead.

## Scripts (run from the repo root)

- `bun run dev` — start the web dev server
- `bun run dev:mobile` — start the Expo dev server for the iOS app
- `bun run build` — typecheck every workspace and build the web app
- `bun run typecheck` — typecheck every workspace
- `bun run test` — run every workspace's tests (Vitest)
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

To try a migration locally first:

1. Start Docker, then `bun run db:start`. The first run downloads the
   Supabase images and prints a local API URL and anon key.
2. Point `apps/web/.env.local` at the local stack — `VITE_SUPABASE_URL=http://127.0.0.1:54321`
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
