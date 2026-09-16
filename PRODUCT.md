# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The owner plus a small group of known people (e.g. classmates or family) who each sign up for their own account and build their own study sets. Not a public/general-audience product — no anonymous signup flow or discovery surface is expected.

## Product Purpose

A flashcard study app for learning vocabulary (Spanish accent-character support is built in). Each card shows an image and an optional hint; the learner types the answer rather than picking from multiple choice. Study sets are created, edited, and studied by signed-in users. Success means a learner can build a set of image-based cards and reliably drill recall of the answers, with quiz attempts graded and logged (3-attempt grading, per `docs/` and recent commits).

## Positioning

Not attempting a unique study mechanism versus Quizlet — the reason to build this instead of using an existing tool is simplicity and control: a minimal, ad-free app the owner fully controls (data, cost, feature set), not a general-purpose competitor.

## Operating Context

- Deployed as a static site to GitHub Pages (`HashRouter` is used specifically for GitHub Pages compatibility).
- Backed by Supabase (Postgres + Auth + Storage) for accounts, study sets, cards, images, and quiz attempt logs.
- Core workflows: sign in/up → dashboard of study sets → create/edit a study set and its cards (image + hint + answer, in order) → study session (quiz mode, image prefetching, 3-attempt grading) with attempts logged.

## Capabilities and Constraints

- Study sets and cards are CRUD (create/read/update/delete) by their owner; images are uploaded and stored via Supabase Storage.
- An accented-character helper keypad exists for typing Spanish answers (á, é, í, ó, ú, ñ), confirming Spanish-language content is a first-class case, not just an example.
- Quiz mode grades typed answers with up to 3 attempts per card and logs attempts.
- No stated requirement to run on a paid or scaling infrastructure tier; no other constraints beyond what the current stack (Vite/React/TypeScript, Tailwind + shadcn/ui, TanStack Query, Supabase) implies.

## Evidence on Hand

No case studies, testimonials, or press exist or are needed — this is a personal/small-group tool, not a marketed product. No production content beyond what the owner and their small group create as real study sets.

## Product Principles

1. Keep the tool minimal and self-controlled rather than chasing feature parity with general flashcard products.
2. Favor typed-recall (image + hint → typed answer) over recognition-based quizzing (multiple choice).
3. Treat non-English/accented content (starting with Spanish) as a normal case in every input surface, not an edge case.
4. Keep the app cheap and simple to run: static hosting + a single managed backend (Supabase), no added infrastructure.
