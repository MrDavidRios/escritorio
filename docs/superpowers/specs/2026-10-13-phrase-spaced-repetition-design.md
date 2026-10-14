# Phrase spaced repetition design

## Problem

Learners want to memorize Spanish phrases (idioms, sayings, their own
expressions) over the long term. Study sets don't fit this: they're
drilled as a whole deck on demand, with no notion of "what should I
practice today." We're adding a single per-user phrase collection,
scheduled with spaced repetition, that a learner comes back to daily.

Requirements:

1. One collection of phrases per user, independent of study sets.
2. Each day the learner only gets the phrases spaced repetition says
   are due.
3. When nothing is due, the learner may practice ahead anyway; this
   never affects the spaced-repetition schedule.
4. A calendar shows how many phrases are due on upcoming dates.
5. Phrases can be typed in by hand or added from the idiom list in one
   click, and can carry an optional image.

## Non-goals

- No study-set integration: phrases are not cards, and study sets are
  unchanged (apart from the `QuizCard` refactor below, which must not
  change their behavior).
- One direction only: English → Spanish. No ES→EN review items.
- No review history / stats UI. The review log exists to support it
  later.
- No "Easy" rating or self-rating; grading is automatic.
- Jev is used only for phrase grading in this pass, not study-set
  quizzes.
- No database test framework (pgTAP etc.).

## Terminology

- **SRS** — spaced repetition system: each phrase has a next-due date
  that moves further out every time it's recalled correctly.
- **SM-2** — the classic SRS formula (basis of Anki's scheduler). Each
  phrase stores an *interval* (days until next due) and an *ease*
  (multiplier for interval growth). We use an SM-2-style variant,
  specified under Scheduling.
- **Due session** — a review of today's due phrases. Updates the
  schedule.
- **Practice session** — practice-ahead when nothing (or not enough) is
  due. Logged, never updates the schedule.

## Architecture

```
Browser (static, GitHub Pages)
  ├─ exact match (src/lib/grading.ts isAnswerCorrect) ── correct? done
  ├─ else → Edge Function grade-phrase ── Jev choice → {verdict, confidence}
  ├─ rating from attempts + verdict
  ├─ scheduler.ts nextSchedule() (pure, client-side)
  └─ RPC record_phrase_review(...) → phrase_reviews insert + phrases update (one txn)
```

- **Edge Function `grade-phrase`** is a thin, stateless proxy that keeps
  the TypeSafe API key off the client. It never touches the database.
- **Scheduling runs client-side** as a pure, unit-tested function. Each
  user only owns their own schedule, so server-side tamper-proofing buys
  nothing.
- **Persistence goes through one RPC**, so the review log and the
  schedule can't drift apart.

This adds the app's first server-side code (one Supabase Edge Function).
It stays within Supabase, consistent with the "single managed backend"
principle in PRODUCT.md.

## Data model (migration `0009_phrases.sql`)

### `phrases` (new)

Content and schedule on one row: there's one direction, so one schedule
per phrase.

```sql
create table public.phrases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  spanish text not null,
  english text not null,
  example text,
  image_path text,
  -- Set when added from the idiom list. Content is copied, not linked:
  -- edits never touch the shared idiom, idiom edits never change this row.
  idiom_id uuid references public.idioms (id) on delete set null,
  -- Schedule. due_on null = new, not yet introduced.
  due_on date,
  introduced_on date,
  interval_days integer not null default 0,
  ease numeric(4, 2) not null default 2.00,
  reps integer not null default 0,
  lapses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, idiom_id)
);
```

- Indexes on `owner_id` and `(owner_id, due_on)`.
- `updated_at` trigger (shared `set_updated_at`).
- `owner_id` forced to `auth.uid()` server-side by a before-insert
  trigger. Never trust a client-supplied value (same rule as `cards`).
- RLS: owner-only select/insert/update/delete.
- Dates are the user's **local** calendar dates, supplied by the client
  (same convention as idiom of the day).

### `phrase_reviews` (new, append-only)

One row per phrase resolved in any session (due or practice). It
mirrors `quiz_attempts`.

```sql
create type public.phrase_rating as enum ('again', 'hard', 'good');
create type public.phrase_grade_source as enum ('exact', 'jev', 'fallback');

create table public.phrase_reviews (
  id uuid primary key default gen_random_uuid(),
  phrase_id uuid not null references public.phrases (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  reviewed_on date not null,
  rating phrase_rating not null,
  attempt_count integer not null,
  typed_answer text not null,
  grade_source phrase_grade_source not null,
  jev_verdict text,
  is_practice boolean not null,
  created_at timestamptz not null default now()
);
```

- `owner_id` forced from the parent phrase by trigger (like
  `set_quiz_attempt_lineage`).
- RLS: owner-only select/insert. No update/delete policies.
- Practice reviews are logged with `is_practice = true` and never read
  by scheduling. Any future query counting "reviews done today" must
  filter on `is_practice`.

### `user_settings` (new)

```sql
create table public.user_settings (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  new_phrases_per_day integer not null default 10
    check (new_phrases_per_day between 0 and 100),
  updated_at timestamptz not null default now()
);
```

- RLS: owner-only select/insert/update.
- A missing row means defaults. The client upserts it when the setting
  is first changed.

### RPC `record_phrase_review`

```
record_phrase_review(
  p_phrase_id uuid, p_reviewed_on date, p_rating phrase_rating,
  p_attempt_count int, p_typed_answer text,
  p_grade_source phrase_grade_source, p_jev_verdict text,
  p_is_practice boolean,
  -- ignored when p_is_practice:
  p_due_on date, p_interval_days int, p_ease numeric, p_reps int,
  p_lapses int
)
```

- `security invoker`, so RLS applies.
- Always inserts the `phrase_reviews` row.
- If `p_is_practice`, it stops there. The schedule is never touched,
  and this is enforced in the database rather than trusted to the
  client.
- Otherwise, it locks the phrase row and **refuses if the phrase isn't
  due** (`due_on is not null and due_on > p_reviewed_on`). This guards
  against a retry or a second tab advancing the schedule twice. Then it
  updates the schedule columns, and sets `introduced_on = p_reviewed_on`
  if it was null.
- Raises if the phrase doesn't exist (e.g. deleted in another tab).

### Images

- Stored in the existing private `flashcard-images` bucket at
  `{owner_id}/phrases/{phrase_id}.{ext}`. The existing storage policies
  only check that the first folder is the owner's id, so no new bucket
  or policies are needed.
- Deleting a phrase deletes its image object (as cards do).
- Phrases added from idioms start with no image.

## Grading

### Edge Function `supabase/functions/grade-phrase`

- `POST { english, expected, typed }` → `{ verdict, confidence }`.
- Requires a signed-in user (Supabase JWT verification, on by default),
  so only app users can spend the key.
- Calls Jev's REST endpoint (`https://api.typesafe.ai/v1/systemone`)
  with plain `fetch`. We don't use the `@typesafe-ai/sdk` npm package,
  because it targets Node 20+ and Edge Functions run on Deno.
- One `choice` question, state = English prompt + expected Spanish +
  typed answer, options (each with a description and examples):
  - `exact` — same phrase.
  - `minor_slip` — missing/wrong accent, one-letter typo, dropped or
    wrong article.
  - `valid_variant` — different wording a native speaker would accept
    with the same meaning.
  - `wrong` — anything else.
- Request building and response parsing live in a small pure module
  (`jev.ts`) so they can be unit-tested with `deno test`.
- `TYPESAFE_API_KEY` is a Supabase function secret. It is never in the
  client bundle or GitHub.

### Client grading flow (`src/features/phrases/gradePhrase.ts`)

1. `isAnswerCorrect(typed, expected)` → `exact`, `grade_source = exact`.
   Jev isn't called.
2. Otherwise call `grade-phrase` with a **~4 s timeout**.
3. Confidence < **0.6**, error, or timeout → `wrong`,
   `grade_source = fallback`.
4. Otherwise use Jev's verdict, `grade_source = jev`.

`minor_slip` and `valid_variant` count as correct. Feedback always
shows the exact expected form ("Accepted. Exact form: *meter la pata*").

At session start, fire one background request to `grade-phrase` to
warm a cold Edge Function.

### Attempts → rating

Up to 3 attempts per phrase, as in the existing quiz.

| Outcome | Rating |
|---|---|
| Correct on 1st try via `exact` or `valid_variant` | good |
| `minor_slip` on any try, or correct on 2nd/3rd try | hard |
| Revealed after 3 misses | again |

## Scheduling (`src/features/phrases/scheduler.ts`)

Pure function: `nextSchedule(current, rating, today) → { due_on,
interval_days, ease, reps, lapses }`.

Constants: starting ease **2.0**, ease floor **1.3**, ease ceiling for
recovery **2.0**, learning steps **[1, 3, 7]** days.

- **good**
  - While `reps` < 3 and the phrase has never lapsed: interval = learning
    step `[1, 3, 7][reps]`.
  - Otherwise: interval = `round(interval × ease)`, at least
    `interval + 1`.
  - ease += 0.05 (capped at 2.0). `good` only ever means first-try
    correct, so this is the slow recovery for previously-hard phrases.
- **hard** — interval = `max(interval + 1, round(interval × 1.2))`, or 1
  for a phrase with interval 0. ease −= 0.15.
- **again** — interval = 1, ease −= 0.2, lapses += 1. Relearning after a
  lapse skips the fixed steps; subsequent goods multiply by ease.
- ease is never below 1.3. `reps += 1` on every scheduled review.
  `due_on = today + interval`.

A perfect run: **1, 3, 7, 14, 28, 56, 112** days.

## Daily queue (`src/features/phrases/dailyQueue.ts`)

All pure, from the user's phrases + settings + local `today`.

- **Due today** = phrases with `due_on <= today` (overdue rolls into
  today), plus **new today** = the oldest un-introduced phrases (by
  `created_at`), up to `new_phrases_per_day − (phrases with
  introduced_on = today)`.
- Order: due reviews first (most overdue first), then new phrases.
- **Practice anyway** = the 10 introduced phrases with the soonest
  `due_on` (not due today). New phrases stay in their queue and are
  never pulled into practice.

### Calendar forecast (`src/features/phrases/forecast.ts`)

- For each day from today on: count of scheduled `due_on` on that day
  (overdue counted on today), plus projected new phrases. The projection
  releases the remaining queue `new_phrases_per_day` per day, starting
  with today's remaining allowance.
- Returns `{ date, reviews, new }` per day.
- It's a forecast of the current schedule. It doesn't simulate future
  review outcomes.

## UI

### Entry points

- **Dashboard tile** "Phrases — *N* due today", linking to `/phrases`.
- **Idiom of the Day**: an "Add to my phrases" button that copies
  spanish/english/example and sets `idiom_id`. If the idiom is already
  in the collection, it shows "In your phrases ✓".

### `/phrases`

1. **Today panel**
   - When phrases are due: "12 due today (3 new)" and **Start** →
     `/phrases/review`.
   - When nothing is due: "All caught up. Next 5 due Thursday." and
     **Practice anyway** → `/phrases/practice`, with a note that practice
     doesn't change the schedule. Hidden if there are no introduced
     phrases.
2. **Calendar**: the existing shadcn `Calendar` (react-day-picker) with
   a count per upcoming day. Tapping a day shows "Sat Oct 18 — 6
   reviews, 4 new." It navigates forward by month. Past days show no
   counts.
3. **Phrase list**: add/edit/delete (Spanish, English, optional
   example, optional image via the existing upload/drag-drop/paste +
   `optimizeImage` pipeline). Each row has a "next: Oct 21" or "new"
   tag.
4. **Setting**: an inline "New phrases per day: [10]" control.

### Sessions: `/phrases/review` and `/phrases/practice`

- The session pins its local date at start, so it doesn't change at
  midnight mid-session.
- Each question shows the English (plus the image if any), a typed
  answer input, and the accent pad. Feedback follows, including
  "Accepted. Exact form: …" for slips and variants.
- Phrases rated `again` in a due session reappear **once** at the end.
  Only the first result is recorded; the repeat isn't logged.
- End summary: first-try correct count, needed-more-tries count, next
  due date. Practice sessions are labeled as practice.

### Component structure

Per the app's preference for dumb shared components with persistence
lifted into thin containers:

- **`TypedAnswerQuiz`** (new, `src/components/`): presentational. It
  handles attempts, feedback, the accent pad and Next. Props:
  `grade(typed) => Promise<Verdict>`, `onResolved(result)`, plus prompt
  content. No data access.
- **`QuizCard`** becomes a thin study-set wrapper around it. Its
  behavior is unchanged: exact grading, `quiz_attempts` logging.
- **`PhraseQuizCard`** (new): a thin wrapper that grades via
  `gradePhrase` and records via the RPC.

New files live under `src/features/phrases/`, with API modules in
`src/api/phrases.ts`, `src/api/phraseReviews.ts` and
`src/api/userSettings.ts`, and types in `src/types/phrase.ts`, following
existing layout. `phraseImagePath` sits alongside `cardImagePath` in
`src/api/cardImages.ts`.

## Deployment

- **Migration**: applied by the Supabase GitHub integration on merge
  to `develop`, as today.
- **Edge Function**: the integration only deploys functions declared in
  a committed `supabase/config.toml`, which this repo deliberately
  doesn't commit (it would push auth settings to production; see
  README). So add `.github/workflows/deploy-functions.yml`:
  - Runs on push to `develop` touching `supabase/functions/**`, plus
    `workflow_dispatch`.
  - Steps: `supabase/setup-cli` → `deno test` for the function →
    `supabase functions deploy grade-phrase --project-ref
    $SUPABASE_PROJECT_REF`.
  - Repo secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`.
- **One-time setup**: set `TYPESAFE_API_KEY` as a Supabase function
  secret.
- README gains an "Edge Functions" note beside the migrations note.
- The migration and function are independent; deploy order doesn't
  matter.

### Limits (Supabase free plan)

CPU 2 s/request (excludes I/O wait), wall clock 150 s, memory 256 MB,
500k invocations/month. The function is I/O-bound and tiny. Worst case
~10 users × 50 phrases × 3 non-exact attempts ≈ 45k calls/month, under
10% of quota. Jev's own rate limits aren't documented publicly; at this
volume we don't expect to hit them, and if we did, the strict-grading
fallback covers it.

## Error handling

| Failure | Behavior |
|---|---|
| Jev error / timeout / low confidence | Strict exact-match grading, `grade_source = fallback`. The session never blocks. |
| `record_phrase_review` fails | Two retries, then a notice: "Couldn't save. This phrase will stay due." The session continues; the schedule didn't move. |
| Duplicate save (retry, second tab) | The RPC refuses a scheduled review of a phrase that's not due. Duplicate practice logs are harmless. |
| Midnight mid-session | The session uses the local date pinned at start. |
| Phrase deleted mid-session | The RPC raises not found; the phrase is skipped. |
| Adding an already-added idiom | The unique constraint catches it; the UI shows "In your phrases ✓". |
| Image upload fails | Same behavior as card images. |

## Testing

- **Vitest** (CI):
  - `scheduler.ts`: perfect run 1/3/7/14/28/56; hard; again; ease
    floor 1.3; recovery capped at 2.0; relearning after a lapse.
  - Rating from attempts + verdict.
  - `gradePhrase.ts` with `fetch` mocked: exact match skips Jev; low
    confidence, timeout and error each fall back.
  - `forecast.ts`: due counts, overdue into today, new release under
    the cap, introduced-today counted against the cap.
  - `dailyQueue.ts`: due set ordering, practice-anyway set.
- **`QuizCard` refactor**: study-set sessions behave the same, verified
  by running a session in the app.
- **Edge Function**: `deno test` on `jev.ts`, run in the deploy
  workflow before deploying.
- **Database**: `bun run db:reset` locally. Check by hand that RLS
  isolates users and that `is_practice = true` never changes `phrases`.
- **End to end**: the app against the local stack, with `supabase
  functions serve` for grading. Run a due session, a practice session
  and the calendar.
