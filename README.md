# Escritorio

A Quizlet-like flashcard study app. Each card shows an image and an optional
hint; you type the answer. Study sets are created, saved, and edited by
signed-in users, backed by Supabase (Postgres + Auth + Storage) and deployed
as a static site to GitHub Pages.

See `docs/` for the implementation plan (or ask about it — it's tracked
outside this repo for now).

## Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui (Radix UI)
- TanStack Query
- react-router-dom (`HashRouter`, for GitHub Pages compatibility)
- Supabase JS client

## Local development

1. Copy `.env.local.example` to `.env.local` and fill in your Supabase
   project's URL and anon key.
2. `npm install`
3. `npm run dev`

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — typecheck and build for production
- `npm run test` — run the unit test suite (Vitest)
- `npm run lint` — lint with oxlint
- `npm run preview` — preview the production build locally
