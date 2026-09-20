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
