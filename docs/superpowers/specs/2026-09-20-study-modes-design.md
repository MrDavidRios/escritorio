# Study modes design

## Problem

Today a study session always shows every card's image + definition and
grades the typed answer against `spanish_term`. This is really one
fixed "mode." We're adding two selectable modes:

1. **Conversion** — English word ↔ Spanish word. A direction setting
   picks English→Spanish, Spanish→English, or random (resolved
   per-card).
2. **Meaning** — definition/image → Spanish word (today's behavior,
   but configurable). A visibility setting picks whether the question
   shows the image, the definition, or both.

The mode + its setting must be selectable on the study set page before
starting a session, persisted per study set, and every session logged
with enough context to later show a learner their favorite mode and
their success rate per mode.

## Non-goals

- No new quizzing mechanic (still typed-recall, 3-attempt grading).
- No cross-device sync beyond what's already true (Supabase-backed, so
  it's already cross-device).
- No backfill of historical `quiz_attempts` with mode context — those
  rows predate this feature and stay as they are.
- No analytics UI in this pass — only the data model to support it
  later.

## Data model

New enum types:

```sql
create type public.study_mode as enum ('conversion', 'meaning');
create type public.conversion_direction as enum ('en_es', 'es_en', 'random');
create type public.meaning_visibility as enum ('image', 'definition', 'both');
```

### `study_sets` (altered)

Adds the persisted picker state, so the set page reads it directly off
data it already loads — no extra query, no separate loading state for
the picker:

- `study_mode study_mode not null default 'meaning'`
- `conversion_direction conversion_direction not null default 'en_es'`
- `meaning_visibility meaning_visibility not null default 'both'`

Defaults are chosen so every existing study set keeps behaving exactly
as it does today (meaning mode, "both" visibility matches the current
hardcoded image+definition display).

### `study_sessions` (new)

One row per study session (a run through the deck in a given mode),
written so later queries can show favorite mode / success rate per
mode without joining through configuration scattered across attempts:

```sql
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references public.study_sets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  mode study_mode not null,
  direction conversion_direction,   -- null unless mode = 'conversion'
  visibility meaning_visibility,    -- null unless mode = 'meaning'
  deck_size integer not null,
  cards_answered integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
```

Constraints:
- `check ((mode = 'conversion') = (direction is not null))`
- `check ((mode = 'meaning') = (visibility is not null))`

RLS: owner-only select/insert, matching `quiz_attempts`'s pattern —
`owner_id` is set server-side (via a lineage trigger reading the
referenced `study_set_id`'s `owner_id`), never trusted from the client
on insert.

**Departure from `quiz_attempts`'s append-only pattern:** a session
row is opened at start and closed at completion, so it needs a
narrowly-scoped **update** policy (owner-only, own rows) — but the
policy (or a trigger) restricts which columns an update may touch to
`completed_at` and `cards_answered`, so a session can't be rewritten
into a different mode/config after the fact.

### `quiz_attempts` (altered)

- `session_id uuid references public.study_sessions (id) on delete set null` (nullable — existing rows predate sessions and can't be backfilled)
- `resolved_direction conversion_direction` (nullable — only meaningful for conversion-mode attempts, and only carries a fixed value here because `'random'` resolves per card)

Mode and settings are **not** duplicated onto attempts beyond
`resolved_direction`; they're reachable via `session_id →
study_sessions`.

## Mode logic (`src/features/study/studyMode.ts`)

A pure, framework-free module — mirroring `src/lib/grading.ts` — unit
tested directly, no React involved:

```ts
export type StudyConfig =
  | { mode: 'conversion'; direction: 'en_es' | 'es_en' | 'random' }
  | { mode: 'meaning'; visibility: 'image' | 'definition' | 'both' }

export type Question = {
  card: Card
  prompt: string
  expectedAnswer: string
  answerLanguage: 'en' | 'es'
  resolvedDirection: 'en_es' | 'es_en' | null // set only for conversion
}

export function isCardEligible(card: Card, config: StudyConfig): boolean
export function eligibleCards(cards: Card[], config: StudyConfig): Card[]
export function exclusionReason(card: Card, config: StudyConfig): string | null
export function buildQuestion(card: Card, config: StudyConfig, rng: () => number): Question
```

Eligibility rules (strict, per settled design):

- **Conversion**: card needs a non-empty `english_equivalent`.
- **Meaning / image**: card needs `image_path`.
- **Meaning / definition**: card needs `definition`.
- **Meaning / both**: card needs **both** `image_path` and
  `definition` — this is the narrowest deck under meaning mode, not
  the widest. A set mixing image-only and definition-only cards can
  produce an *empty* deck under "both"; the set page must handle that
  explicitly (see below), not just an empty-state message deep in the
  session.

`buildQuestion` resolves `'random'` per card using the injected `rng`
(so it's deterministically testable with a seeded function), and
builds the prompt/expected-answer/language triple:

- conversion `en_es`: prompt = `english_equivalent`, expected =
  `spanish_term`, language = `'es'`.
- conversion `es_en`: prompt = `spanish_term`, expected =
  `english_equivalent`, language = `'en'`.
- meaning (`image` / `definition` / `both`): prompt carries which
  visual elements to show (image, definition, or both — same as
  today's fixed display), expected = `spanish_term`, language =
  `'es'`.

`exclusionReason` returns the copy used for the per-card badge (e.g.
"No English equivalent", "No definition") or `null` when eligible.

## Study set page

**`StudyModePicker`** (new, dumb component): a split control — "Start
studying" as the primary action button, with an adjacent
dropdown-menu trigger listing the two modes (radio-style selection,
built on the existing `radix-ui` dependency — `dropdown-menu` and
`toggle-group` primitives get generated into `components/ui/`, no new
package). The active mode's setting renders inline next to the split
button as a segmented control (`toggle-group`): 3 options for
direction under conversion, 3 for visibility under meaning.

`StudySetPage` owns persistence, exactly like the existing inline
title/description edits: an `onChange` from the picker calls
`patchStudySet` and drives the existing `useSaveStatus`, so changing
mode/settings shows the same save-status indicator as any other field.

The live `StudyConfig` flows down into `CardsSection` → `CardTile`,
which gains an optional `excludedReason?: string` prop rendering a
badge when the card is excluded under the current config. Flipping a
setting re-filters immediately and badges update live, per the
answered design.

The Start button's label shows the real eligible deck size when it
differs from the total (`"Start studying · 8 of 12 cards"`). When the
eligible deck is **empty**, the button disables and a message beneath
it names why (e.g. "No cards have both an image and a definition —
try a different visibility setting").

## Session page + QuizCard

`StudySessionPage` reads `StudyConfig` off the already-loaded
`studySet` record (no separate fetch), computes `eligibleCards`, and
builds the ordered list of `Question`s **once into state on mount**,
not via `useMemo` — under per-card random direction, a `useMemo`
recompute (e.g. from an unrelated re-render) must not reshuffle
directions mid-session.

On mount, with a non-empty deck, it inserts a `study_sessions` row
(`mode`, `direction`/`visibility`, `deck_size`) and keeps its id in
state. When the deck completes, it updates that row with
`completed_at` and final `cards_answered`. Clicking "Study again"
starts an entirely new session row (matching "one row per run").

`QuizCard` becomes presentational over a `Question` instead of a raw
`Card`:
- Renders whatever the question's mode dictates (word-only prompt for
  conversion; image/definition/both for meaning — this is today's
  existing rendering, now driven by config instead of hardcoded).
- Grades against `question.expectedAnswer` (still via the unchanged,
  direction-agnostic `isAnswerCorrect`).
- Hides `AccentedCharPad` when `answerLanguage === 'en'` — irrelevant
  when typing an English answer.
- Logs each attempt with `session_id` and `resolved_direction` (null
  outside conversion mode) alongside the existing
  `card_id`/`is_correct`/`attempt_count`.

Grading logic itself (`isAnswerCorrect`, `normalizeAnswer`) is
unchanged.

## Testing

- Unit tests for `studyMode.ts`, styled like `grading.test.ts`:
  eligibility across every mode/setting × card-shape combination
  (including the all-excluded/empty-deck case), `buildQuestion`
  correctness in both explicit directions, and `'random'` resolution
  with a seeded `rng`.
- `oxlint` + `vitest run` + `tsc -b` (via `bun run build`) as the
  automated gate.
- Supabase-side pieces (migration apply, RLS policy behavior, live
  session writes) have no automated harness in this repo and are
  **left to manual verification by the user** — not claimed as tested
  by this work.

## Rollout sequencing

1. Migration (`0006_study_modes.sql`) + `Card`/`StudySet` type updates
   — mechanical, low-risk, unblocks everything else.
2. `studyMode.ts` + its unit tests — pure logic, independently
   verifiable before any UI changes depend on it.
3. Study set page: picker, settings, exclusion badges, persistence.
4. Session page + `QuizCard`: config-driven questions, session
   read/write logging.

Steps 3 and 4 both depend on 1 and 2, but are otherwise independent of
each other (set page doesn't need the session page to work, and vice
versa given a manually-set config) — good candidates to parallelize
across subagents once 1–2 land.
