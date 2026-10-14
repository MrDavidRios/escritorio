# Phrase Spaced Repetition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-user phrase collection, separate from study sets, that the learner reviews daily on an SM-2-style spaced-repetition schedule. Answers are typed and auto-graded with exact match, then Jev. The learner can practice ahead without changing the schedule and sees an upcoming-due calendar.

**Architecture:**
- A stateless Supabase Edge Function (`grade-phrase`) proxies Jev so the TypeSafe API key never reaches the browser.
- All scheduling, queueing and forecasting are pure client-side TypeScript, unit-tested with vitest.
- One Postgres RPC (`record_phrase_review`) atomically appends to the review log and updates a phrase's schedule. For practice reviews it only logs.
- UI follows the repo's "dumb components + thin container" pattern.

**Tech Stack:** Vite + React 19 + TypeScript, TanStack Query, Tailwind + shadcn/ui (react-day-picker `Calendar`), Supabase (Postgres, RLS, Storage, Edge Functions on Deno), vitest, `deno test`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-13-phrase-spaced-repetition-design.md`

## Global Constraints

- All dates are the user's **local** calendar dates as `YYYY-MM-DD` strings (`DateKey`), produced with `localDateKey` from `src/features/idioms/idiomOfTheDay.ts`. Never use UTC dates for due logic.
- One direction only: English prompt → typed Spanish answer.
- Max **3** attempts per phrase.
- Rating map: correct on the 1st try via `exact`/`valid_variant` → `good`; `minor_slip` on any try, or correct on the 2nd/3rd → `hard`; revealed → `again`.
- Scheduler constants: starting ease **2.0**, ease floor **1.3**, recovery cap **2.0**, learning steps **[1, 3, 7]**. Perfect run is **1, 3, 7, 14, 28, 56, 112** days.
- Default `new_phrases_per_day` **10**, allowed range **0–100**.
- Practice-anyway session size **10**.
- Jev: confidence threshold **0.6**; client timeout **4000 ms**; the Edge Function's own fetch timeout **3500 ms**; model `"jev-latest"`; endpoint `https://api.typesafe.ai/v1/systemone`; plain `fetch` (no `@typesafe-ai/sdk`).
- `TYPESAFE_API_KEY` exists only as a Supabase function secret (and in the git-ignored `supabase/functions/.env.local` locally). Never put it in `src/`, `VITE_*` env, or GitHub.
- Phrase images live in the existing `flashcard-images` bucket at `{owner_id}/phrases/{phrase_id}.{ext}`.
- No new npm dependencies.
- Spanish text in the UI gets `lang="es"`.
- Never run migrations by hand against production. The Supabase GitHub integration applies them on merge to `develop`. Locally, use `bun run db:reset`.
- Every commit message ends with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (pass a second `-m`).
- Work on a feature branch off `develop` (e.g. `feat/phrase-srs`), never on `develop` directly.

## Review Focus

1. **Blank or whitespace-only answer.** It should be graded wrong immediately, without spending a Jev call or waiting on the network. Pinned in Task 2.
2. **Jev hangs past the timeout.** Grading must resolve as a strict fallback at 4 s, not leave the session stuck on "Checking…". Pinned in Task 2 (fake timers).
3. **Phrases overdue by many days** (the learner skipped a week). They must appear in today's queue and on today's calendar cell, not vanish into past dates. Pinned in Task 3.
4. **Daily new cap already used today** (the learner finished today's session, then added 20 phrases). No more new phrases today; the forecast starts releasing them tomorrow. Pinned in Task 3.
5. **A missed phrase's end-of-session repeat.** The repeat must not be saved and must not be queued again if missed a second time. Otherwise the session never ends and the schedule gets double-written. Pinned in Task 9.

---

## File Structure

```
supabase/migrations/0009_phrases.sql              tables, triggers, RLS, RPC
supabase/functions/grade-phrase/jev.ts            pure: validate request, build Jev payload, parse Jev response
supabase/functions/grade-phrase/jev_test.ts       deno tests for jev.ts
supabase/functions/grade-phrase/index.ts          Deno.serve handler (CORS, warmup, secret, fetch)
.github/workflows/deploy-functions.yml            deno test + supabase functions deploy

src/types/phrase.ts                               Phrase, PhraseSchedule, ratings, verdicts, settings
src/features/phrases/dates.ts                     DateKey helpers (todayKey, addDays, daysBetween, labels)
src/features/phrases/scheduler.ts                 nextSchedule (SM-2 variant)
src/features/phrases/grading.ts                   gradePhrase (exact → Jev → fallback), ratingFor, feedbackNote
src/features/phrases/dailyQueue.ts                dueToday, newAllowanceToday, practiceSet
src/features/phrases/forecast.ts                  forecast per day (reviews + projected new)
src/features/phrases/sessionQueue.ts              session items, end-of-session repeat, summary
src/features/phrases/phraseSchema.ts              zod schema for the phrase form
src/api/phrases.ts                                CRUD + addIdiomAsPhrase
src/api/phraseReviews.ts                          recordPhraseReview RPC wrapper + error mapping
src/api/userSettings.ts                           get/update new_phrases_per_day
src/api/gradePhrase.ts                            supabase.functions.invoke wrapper + warmup
src/api/cardImages.ts                             (modify) add phraseImagePath
src/features/phrases/hooks/usePhrases.ts          query + create/update/delete/add-idiom mutations
src/features/phrases/hooks/useUserSettings.ts     settings query + mutation
src/features/phrases/hooks/useRecordPhraseReview.ts
src/components/typedAnswerState.ts                pure attempt/feedback state machine
src/components/TypedAnswerQuiz.tsx                dumb typed-answer quiz UI
src/features/study/QuizCard.tsx                   (modify) thin wrapper over TypedAnswerQuiz
src/features/phrases/PhraseQuizCard.tsx           thin wrapper: prompt + phrase grading
src/features/phrases/PhrasesPage.tsx              container for /phrases
src/features/phrases/TodayPanel.tsx               dumb
src/features/phrases/PhraseCalendar.tsx           dumb (local selected-day UI state only)
src/features/phrases/PhraseList.tsx               dumb
src/features/phrases/PhraseFormDialog.tsx         dumb form dialog (+ delete confirm)
src/features/phrases/PhraseImageField.tsx         dumb image picker (file/drop/paste)
src/features/phrases/NewPerDaySetting.tsx         dumb
src/features/phrases/PhraseSessionPage.tsx        container for /phrases/review and /phrases/practice
src/features/phrases/PhrasesTile.tsx              dumb dashboard tile
src/features/study-sets/DashboardPage.tsx         (modify) render PhrasesTile
src/features/idioms/IdiomOfTheDayCard.tsx         (modify) "Add to my phrases" button
src/features/idioms/IdiomOfTheDayBanner.tsx       (modify) wire add-to-phrases
src/app/router.tsx                                (modify) three routes
README.md                                         (modify) Edge Functions section
```

---

### Task 1: Phrase types, date helpers, and the scheduler

**Files:**
- Create: `src/types/phrase.ts`
- Create: `src/features/phrases/dates.ts`
- Create: `src/features/phrases/dates.test.ts`
- Create: `src/features/phrases/scheduler.ts`
- Create: `src/features/phrases/scheduler.test.ts`

**Interfaces:**
- Consumes: `localDateKey(date: Date): string` from `@/features/idioms/idiomOfTheDay`
- Produces:
  - `src/types/phrase.ts`: `DateKey`, `PhraseRating`, `PhraseGradeSource`, `JevVerdict`, `PhraseSchedule`, `Phrase`, `PhraseInput`, `UserSettings`
  - `dates.ts`: `todayKey(now?: Date): DateKey`, `parseDateKey(key): Date`, `addDays(key, days): DateKey`, `daysBetween(from, to): number`, `shortDate(key): string`, `longDate(key): string`, `relativeDayLabel(key, today): string`
  - `scheduler.ts`: `STARTING_EASE`, `MIN_EASE`, `MAX_RECOVERED_EASE`, `LEARNING_STEPS`, `type ScheduleUpdate`, `nextSchedule(current: PhraseSchedule, rating: PhraseRating, today: DateKey): ScheduleUpdate`

- [ ] **Step 1: Create the types**

`src/types/phrase.ts`:

```ts
/** Local calendar date as YYYY-MM-DD (see localDateKey). */
export type DateKey = string

export type PhraseRating = 'again' | 'hard' | 'good'
export type PhraseGradeSource = 'exact' | 'jev' | 'fallback'
export type JevVerdict = 'exact' | 'minor_slip' | 'valid_variant' | 'wrong'

export interface PhraseSchedule {
  /** Null while the phrase is new (not yet introduced). */
  due_on: DateKey | null
  introduced_on: DateKey | null
  interval_days: number
  ease: number
  reps: number
  lapses: number
}

export interface Phrase extends PhraseSchedule {
  id: string
  owner_id: string
  spanish: string
  english: string
  example: string | null
  image_path: string | null
  /** Set when added from the idiom list; content is a copy, not a link. */
  idiom_id: string | null
  created_at: string
  updated_at: string
}

export interface PhraseInput {
  spanish: string
  english: string
  example: string | null
  image_path: string | null
  idiom_id: string | null
}

export interface UserSettings {
  new_phrases_per_day: number
}
```

- [ ] **Step 2: Write the failing date tests**

`src/features/phrases/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  longDate,
  parseDateKey,
  relativeDayLabel,
  shortDate,
  todayKey,
} from './dates'

describe('todayKey', () => {
  it('uses the local calendar date, whatever the time of day', () => {
    expect(todayKey(new Date(2026, 9, 13, 0, 1))).toBe('2026-10-13')
    expect(todayKey(new Date(2026, 9, 13, 23, 59))).toBe('2026-10-13')
  })
})

describe('parseDateKey', () => {
  it('returns local midnight of that date', () => {
    const d = parseDateKey('2026-10-13')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 13, 0])
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('counts calendar days across a DST change', () => {
    // US DST ends Sun 2026-11-01.
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02')
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09')
  })

  it('handles negative offsets', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('daysBetween', () => {
  it('counts whole calendar days from one key to another', () => {
    expect(daysBetween('2026-10-13', '2026-10-20')).toBe(7)
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
    expect(daysBetween('2026-10-20', '2026-10-13')).toBe(-7)
  })
})

describe('labels', () => {
  it('shortDate is month + day', () => {
    expect(shortDate('2026-10-21')).toBe('Oct 21')
  })

  it('longDate includes the weekday', () => {
    expect(longDate('2026-10-17')).toBe('Sat, Oct 17')
  })

  it('relativeDayLabel says tomorrow, a weekday within a week, else a short date', () => {
    expect(relativeDayLabel('2026-10-13', '2026-10-13')).toBe('today')
    expect(relativeDayLabel('2026-10-14', '2026-10-13')).toBe('tomorrow')
    expect(relativeDayLabel('2026-10-15', '2026-10-13')).toBe('Thursday')
    expect(relativeDayLabel('2026-10-19', '2026-10-13')).toBe('Monday')
    expect(relativeDayLabel('2026-10-20', '2026-10-13')).toBe('Oct 20')
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bunx vitest run src/features/phrases/dates.test.ts`
Expected: FAIL. The import of `./dates` doesn't resolve.

- [ ] **Step 4: Implement `dates.ts`**

`src/features/phrases/dates.ts`:

```ts
import { localDateKey } from '@/features/idioms/idiomOfTheDay'
import type { DateKey } from '@/types/phrase'

const MS_PER_DAY = 86_400_000

export function todayKey(now: Date = new Date()): DateKey {
  return localDateKey(now)
}

/** Local midnight of `key`. */
export function parseDateKey(key: DateKey): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** The calendar date `days` after `key` (negative goes back). DST-safe. */
export function addDays(key: DateKey, days: number): DateKey {
  const date = parseDateKey(key)
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days))
}

/** Whole calendar days from `from` to `to`. */
export function daysBetween(from: DateKey, to: DateKey): number {
  const utc = (key: DateKey) => {
    const [year, month, day] = key.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((utc(to) - utc(from)) / MS_PER_DAY)
}

/** "Oct 21" */
export function shortDate(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "Sat, Oct 17" */
export function longDate(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** "today", "tomorrow", a weekday name within the coming week, else "Oct 21". */
export function relativeDayLabel(key: DateKey, today: DateKey): string {
  const days = daysBetween(today, key)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days > 1 && days < 7) {
    return parseDateKey(key).toLocaleDateString('en-US', { weekday: 'long' })
  }
  return shortDate(key)
}
```

- [ ] **Step 5: Run the date tests**

Run: `bunx vitest run src/features/phrases/dates.test.ts`
Expected: PASS

- [ ] **Step 6: Write the failing scheduler tests**

`src/features/phrases/scheduler.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { PhraseRating, PhraseSchedule } from '@/types/phrase'
import { nextSchedule } from './scheduler'

const TODAY = '2026-10-13'

const NEW: PhraseSchedule = {
  due_on: null,
  introduced_on: null,
  interval_days: 0,
  ease: 2,
  reps: 0,
  lapses: 0,
}

function run(ratings: PhraseRating[], start: PhraseSchedule = NEW) {
  let schedule = start
  const intervals: number[] = []
  for (const rating of ratings) {
    const next = nextSchedule(schedule, rating, TODAY)
    intervals.push(next.interval_days)
    schedule = { ...schedule, ...next }
  }
  return { intervals, final: schedule }
}

describe('nextSchedule', () => {
  it('follows 1, 3, 7, 14, 28, 56, 112 on a perfect run', () => {
    expect(run(Array<PhraseRating>(7).fill('good')).intervals).toEqual([1, 3, 7, 14, 28, 56, 112])
  })

  it('sets due_on to today + interval, across month boundaries', () => {
    expect(nextSchedule(NEW, 'good', '2026-10-31').due_on).toBe('2026-11-01')
  })

  it('counts every scheduled review in reps', () => {
    expect(run(['good', 'hard', 'again']).final.reps).toBe(3)
  })

  it('still uses the learning steps when a new phrase starts with a hard', () => {
    expect(run(['hard', 'good', 'good']).intervals).toEqual([1, 3, 7])
  })

  it('hard on a new phrase is 1 day and costs 0.15 ease', () => {
    const next = nextSchedule(NEW, 'hard', TODAY)
    expect(next.interval_days).toBe(1)
    expect(next.ease).toBe(1.85)
  })

  it('hard grows the interval by 1.2x, at least +1 day', () => {
    expect(nextSchedule({ ...NEW, interval_days: 10, reps: 5 }, 'hard', TODAY).interval_days).toBe(12)
    expect(nextSchedule({ ...NEW, interval_days: 3, reps: 2 }, 'hard', TODAY).interval_days).toBe(4)
  })

  it('again resets to 1 day, costs 0.2 ease, and counts a lapse', () => {
    const next = nextSchedule({ ...NEW, interval_days: 28, reps: 5, ease: 2 }, 'again', TODAY)
    expect(next).toMatchObject({ interval_days: 1, ease: 1.8, lapses: 1, due_on: '2026-10-14' })
  })

  it('never drops ease below 1.3', () => {
    expect(nextSchedule({ ...NEW, ease: 1.4, interval_days: 5, reps: 4 }, 'again', TODAY).ease).toBe(1.3)
    expect(nextSchedule({ ...NEW, ease: 1.35, interval_days: 5, reps: 4 }, 'hard', TODAY).ease).toBe(1.3)
  })

  it('good recovers ease by 0.05, capped at 2.0', () => {
    const recovering = nextSchedule({ ...NEW, ease: 1.7, interval_days: 10, reps: 5 }, 'good', TODAY)
    expect(recovering).toMatchObject({ ease: 1.75, interval_days: 17 })
    expect(nextSchedule({ ...NEW, ease: 1.98, interval_days: 10, reps: 5 }, 'good', TODAY).ease).toBe(2)
  })

  it('relearning after a lapse multiplies by ease instead of replaying the steps', () => {
    const lapsed = { ...NEW, interval_days: 1, reps: 6, lapses: 1, ease: 1.8 }
    expect(nextSchedule(lapsed, 'good', TODAY).interval_days).toBe(2)
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `bunx vitest run src/features/phrases/scheduler.test.ts`
Expected: FAIL. `./scheduler` doesn't resolve.

- [ ] **Step 8: Implement `scheduler.ts`**

`src/features/phrases/scheduler.ts`:

```ts
import type { DateKey, PhraseRating, PhraseSchedule } from '@/types/phrase'
import { addDays } from './dates'

export const STARTING_EASE = 2.0
export const MIN_EASE = 1.3
/** `good` slowly restores ease lost to hard/again, but never above the start. */
export const MAX_RECOVERED_EASE = 2.0
/** Fixed intervals for the first three reviews of a never-lapsed phrase. */
export const LEARNING_STEPS = [1, 3, 7] as const

const EASE_RECOVERY = 0.05
const HARD_EASE_PENALTY = 0.15
const AGAIN_EASE_PENALTY = 0.2
const HARD_GROWTH = 1.2

export interface ScheduleUpdate {
  due_on: DateKey
  interval_days: number
  ease: number
  reps: number
  lapses: number
}

function roundEase(ease: number): number {
  return Math.round(ease * 100) / 100
}

/**
 * SM-2-style next schedule after a scheduled review. `good` only ever means
 * correct on the first try (see ratingFor), so it's also where ease recovers.
 */
export function nextSchedule(
  current: PhraseSchedule,
  rating: PhraseRating,
  today: DateKey,
): ScheduleUpdate {
  let interval: number
  let ease = current.ease
  let lapses = current.lapses

  switch (rating) {
    case 'good':
      interval =
        current.lapses === 0 && current.reps < LEARNING_STEPS.length
          ? LEARNING_STEPS[current.reps]
          : Math.max(current.interval_days + 1, Math.round(current.interval_days * current.ease))
      ease = Math.min(MAX_RECOVERED_EASE, ease + EASE_RECOVERY)
      break
    case 'hard':
      interval =
        current.interval_days === 0
          ? 1
          : Math.max(current.interval_days + 1, Math.round(current.interval_days * HARD_GROWTH))
      ease = Math.max(MIN_EASE, ease - HARD_EASE_PENALTY)
      break
    case 'again':
      interval = 1
      ease = Math.max(MIN_EASE, ease - AGAIN_EASE_PENALTY)
      lapses += 1
      break
  }

  return {
    due_on: addDays(today, interval),
    interval_days: interval,
    ease: roundEase(ease),
    reps: current.reps + 1,
    lapses,
  }
}
```

- [ ] **Step 9: Run the scheduler tests**

Run: `bunx vitest run src/features/phrases/`
Expected: PASS (both files)

- [ ] **Step 10: Commit**

```bash
git add src/types/phrase.ts src/features/phrases/dates.ts src/features/phrases/dates.test.ts src/features/phrases/scheduler.ts src/features/phrases/scheduler.test.ts
git commit -m "feat(phrases): add phrase types, date helpers, and SM-2-style scheduler" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Phrase grading (exact → Jev → fallback) and rating

**Files:**
- Create: `src/features/phrases/grading.ts`
- Create: `src/features/phrases/grading.test.ts`

**Interfaces:**
- Consumes: `isAnswerCorrect`, `normalizeAnswer` from `@/lib/grading`; `JevVerdict`, `PhraseGradeSource`, `PhraseRating` from `@/types/phrase`
- Produces:
  - `JEV_CONFIDENCE_THRESHOLD = 0.6`, `JEV_TIMEOUT_MS = 4000`
  - `interface JevGradeRequest { english: string; expected: string; typed: string }`
  - `interface JevGrade { verdict: JevVerdict; confidence: number }`
  - `type JevGrader = (request: JevGradeRequest, signal: AbortSignal) => Promise<JevGrade>`
  - `interface PhraseGrade { correct: boolean; verdict: JevVerdict; source: PhraseGradeSource; jevVerdict: JevVerdict | null }`
  - `gradePhrase(typed: string, phrase: { english: string; spanish: string }, callJev: JevGrader, timeoutMs?: number): Promise<PhraseGrade>`, which never rejects
  - `ratingFor(r: { correct: boolean; attemptCount: number; verdict: JevVerdict }): PhraseRating`
  - `feedbackNote(grade: PhraseGrade, expected: string): string | null`

- [ ] **Step 1: Write the failing tests**

`src/features/phrases/grading.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { feedbackNote, gradePhrase, ratingFor, type JevGrader } from './grading'

const phrase = { english: "to put one's foot in it", spanish: 'meter la pata' }

afterEach(() => {
  vi.useRealTimers()
})

describe('gradePhrase', () => {
  it('accepts an exact match without calling Jev', async () => {
    const callJev = vi.fn<JevGrader>()
    await expect(gradePhrase('  Meter la pata! ', phrase, callJev)).resolves.toEqual({
      correct: true,
      verdict: 'exact',
      source: 'exact',
      jevVerdict: null,
    })
    expect(callJev).not.toHaveBeenCalled()
  })

  it('grades a blank answer wrong without calling Jev', async () => {
    const callJev = vi.fn<JevGrader>()
    await expect(gradePhrase('   ', phrase, callJev)).resolves.toEqual({
      correct: false,
      verdict: 'wrong',
      source: 'exact',
      jevVerdict: null,
    })
    expect(callJev).not.toHaveBeenCalled()
  })

  it('sends the English prompt, expected Spanish, and typed answer to Jev', async () => {
    const callJev = vi.fn<JevGrader>().mockResolvedValue({ verdict: 'wrong', confidence: 0.9 })
    await gradePhrase('meter el pie', phrase, callJev)
    expect(callJev).toHaveBeenCalledWith(
      { english: phrase.english, expected: 'meter la pata', typed: 'meter el pie' },
      expect.any(AbortSignal),
    )
  })

  it.each([
    ['minor_slip', true],
    ['valid_variant', true],
    ['exact', true],
    ['wrong', false],
  ] as const)('uses a confident Jev verdict %s (correct: %s)', async (verdict, correct) => {
    const callJev = vi.fn<JevGrader>().mockResolvedValue({ verdict, confidence: 0.9 })
    await expect(gradePhrase('meter la pta', phrase, callJev)).resolves.toEqual({
      correct,
      verdict,
      source: 'jev',
      jevVerdict: verdict,
    })
  })

  it('falls back to strict when Jev is unsure, keeping what Jev said', async () => {
    const callJev = vi.fn<JevGrader>().mockResolvedValue({ verdict: 'minor_slip', confidence: 0.4 })
    await expect(gradePhrase('meter la pta', phrase, callJev)).resolves.toEqual({
      correct: false,
      verdict: 'wrong',
      source: 'fallback',
      jevVerdict: 'minor_slip',
    })
  })

  it('falls back to strict when the Jev call fails', async () => {
    const callJev = vi.fn<JevGrader>().mockRejectedValue(new Error('502'))
    await expect(gradePhrase('meter la pta', phrase, callJev)).resolves.toEqual({
      correct: false,
      verdict: 'wrong',
      source: 'fallback',
      jevVerdict: null,
    })
  })

  it('falls back at the timeout instead of waiting forever, and aborts the call', async () => {
    vi.useFakeTimers()
    let seenSignal: AbortSignal | undefined
    const callJev: JevGrader = (_request, signal) => {
      seenSignal = signal
      return new Promise(() => {})
    }
    const pending = gradePhrase('meter la pta', phrase, callJev, 4000)
    await vi.advanceTimersByTimeAsync(4000)
    await expect(pending).resolves.toMatchObject({ correct: false, source: 'fallback' })
    expect(seenSignal?.aborted).toBe(true)
  })
})

describe('ratingFor', () => {
  it('is good for a first-try exact or valid variant', () => {
    expect(ratingFor({ correct: true, attemptCount: 1, verdict: 'exact' })).toBe('good')
    expect(ratingFor({ correct: true, attemptCount: 1, verdict: 'valid_variant' })).toBe('good')
  })

  it('is hard for a minor slip, even on the first try', () => {
    expect(ratingFor({ correct: true, attemptCount: 1, verdict: 'minor_slip' })).toBe('hard')
  })

  it('is hard when it took a second or third try', () => {
    expect(ratingFor({ correct: true, attemptCount: 2, verdict: 'exact' })).toBe('hard')
    expect(ratingFor({ correct: true, attemptCount: 3, verdict: 'exact' })).toBe('hard')
  })

  it('is again when the answer was revealed', () => {
    expect(ratingFor({ correct: false, attemptCount: 3, verdict: 'wrong' })).toBe('again')
  })
})

describe('feedbackNote', () => {
  it('shows the exact form for slips and variants', () => {
    const grade = { correct: true, verdict: 'minor_slip', source: 'jev', jevVerdict: 'minor_slip' } as const
    expect(feedbackNote(grade, 'meter la pata')).toBe('Accepted. Exact form: meter la pata')
    expect(feedbackNote({ ...grade, verdict: 'valid_variant' }, 'meter la pata')).toBe(
      'Accepted. Exact form: meter la pata',
    )
  })

  it('has no note for an exact answer or a wrong one', () => {
    expect(
      feedbackNote({ correct: true, verdict: 'exact', source: 'exact', jevVerdict: null }, 'x'),
    ).toBeNull()
    expect(
      feedbackNote({ correct: false, verdict: 'wrong', source: 'jev', jevVerdict: 'wrong' }, 'x'),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run src/features/phrases/grading.test.ts`
Expected: FAIL. `./grading` doesn't resolve.

- [ ] **Step 3: Implement `grading.ts`**

`src/features/phrases/grading.ts`:

```ts
import { isAnswerCorrect, normalizeAnswer } from '@/lib/grading'
import type { JevVerdict, PhraseGradeSource, PhraseRating } from '@/types/phrase'

export const JEV_CONFIDENCE_THRESHOLD = 0.6
/** Covers a cold Edge Function start plus Jev's worst-case latency. */
export const JEV_TIMEOUT_MS = 4000

export interface JevGradeRequest {
  english: string
  expected: string
  typed: string
}

export interface JevGrade {
  verdict: JevVerdict
  confidence: number
}

export type JevGrader = (request: JevGradeRequest, signal: AbortSignal) => Promise<JevGrade>

export interface PhraseGrade {
  correct: boolean
  /** The verdict this grade acts on (strict fallbacks act as 'wrong'). */
  verdict: JevVerdict
  source: PhraseGradeSource
  /** What Jev answered, if it answered at all -- kept for the review log. */
  jevVerdict: JevVerdict | null
}

function strictFallback(jevVerdict: JevVerdict | null): PhraseGrade {
  return { correct: false, verdict: 'wrong', source: 'fallback', jevVerdict }
}

/**
 * Exact match first (no network); otherwise ask Jev. Never rejects: any Jev
 * failure, timeout, or low-confidence answer falls back to strict grading,
 * so a session can't get stuck on the grader.
 */
export async function gradePhrase(
  typed: string,
  phrase: { english: string; spanish: string },
  callJev: JevGrader,
  timeoutMs: number = JEV_TIMEOUT_MS,
): Promise<PhraseGrade> {
  if (isAnswerCorrect(typed, phrase.spanish)) {
    return { correct: true, verdict: 'exact', source: 'exact', jevVerdict: null }
  }
  if (normalizeAnswer(typed) === '') {
    return { correct: false, verdict: 'wrong', source: 'exact', jevVerdict: null }
  }

  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('Jev grading timed out'))
    }, timeoutMs)
  })

  const call = callJev({ english: phrase.english, expected: phrase.spanish, typed }, controller.signal)
  // If the timeout wins, the abandoned call may still reject later.
  call.catch(() => {})

  try {
    const grade = await Promise.race([call, timeout])
    if (grade.confidence < JEV_CONFIDENCE_THRESHOLD) return strictFallback(grade.verdict)
    return {
      correct: grade.verdict !== 'wrong',
      verdict: grade.verdict,
      source: 'jev',
      jevVerdict: grade.verdict,
    }
  } catch {
    return strictFallback(null)
  } finally {
    clearTimeout(timer)
  }
}

export function ratingFor({
  correct,
  attemptCount,
  verdict,
}: {
  correct: boolean
  attemptCount: number
  verdict: JevVerdict
}): PhraseRating {
  if (!correct) return 'again'
  if (attemptCount > 1 || verdict === 'minor_slip') return 'hard'
  return 'good'
}

/** Shown instead of "Correct!" when an answer was accepted but wasn't the exact form. */
export function feedbackNote(grade: PhraseGrade, expected: string): string | null {
  if (!grade.correct) return null
  if (grade.verdict === 'minor_slip' || grade.verdict === 'valid_variant') {
    return `Accepted. Exact form: ${expected}`
  }
  return null
}
```

- [ ] **Step 4: Run the tests**

Run: `bunx vitest run src/features/phrases/grading.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/phrases/grading.ts src/features/phrases/grading.test.ts
git commit -m "feat(phrases): grade typed phrases with exact match, Jev, and strict fallback" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Daily queue and calendar forecast

**Files:**
- Create: `src/features/phrases/dailyQueue.ts`
- Create: `src/features/phrases/dailyQueue.test.ts`
- Create: `src/features/phrases/forecast.ts`
- Create: `src/features/phrases/forecast.test.ts`
- Create: `src/features/phrases/testPhrase.ts` (test fixture helper, imported only by tests)

**Interfaces:**
- Consumes: `Phrase`, `DateKey` (Task 1); `addDays` (Task 1)
- Produces:
  - `PRACTICE_SESSION_SIZE = 10`
  - `newAllowanceToday(phrases: Phrase[], today: DateKey, cap: number): number`
  - `dueToday(phrases, today, cap): { reviews: Phrase[]; fresh: Phrase[] }`
  - `practiceSet(phrases, today, size?): Phrase[]`
  - `FORECAST_DAYS = 400`
  - `interface ForecastDay { date: DateKey; reviews: number; newPhrases: number }`
  - `forecast(phrases, today, cap, days): ForecastDay[]`
  - `nextBusyDay(days: ForecastDay[], today: DateKey): ForecastDay | null`
  - test helper `makePhrase(overrides?: Partial<Phrase>): Phrase`

- [ ] **Step 1: Create the test fixture helper**

`src/features/phrases/testPhrase.ts`:

```ts
import type { Phrase } from '@/types/phrase'

let counter = 0

/** A new (never-reviewed) phrase; override fields to place it in a schedule. */
export function makePhrase(overrides: Partial<Phrase> = {}): Phrase {
  counter += 1
  const n = String(counter).padStart(4, '0')
  return {
    id: `phrase-${n}`,
    owner_id: 'owner-1',
    spanish: `frase ${n}`,
    english: `phrase ${n}`,
    example: null,
    image_path: null,
    idiom_id: null,
    due_on: null,
    introduced_on: null,
    interval_days: 0,
    ease: 2,
    reps: 0,
    lapses: 0,
    created_at: `2026-10-01T00:00:${String(counter % 60).padStart(2, '0')}Z`,
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}
```

- [ ] **Step 2: Write the failing queue tests**

`src/features/phrases/dailyQueue.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { dueToday, newAllowanceToday, practiceSet } from './dailyQueue'
import { makePhrase } from './testPhrase'

const TODAY = '2026-10-13'

function introduced(due_on: string, extra: Parameters<typeof makePhrase>[0] = {}) {
  return makePhrase({ due_on, introduced_on: '2026-10-01', interval_days: 3, reps: 2, ...extra })
}

describe('dueToday', () => {
  it('includes phrases due today and overdue ones, most overdue first', () => {
    const today = introduced('2026-10-13')
    const weekLate = introduced('2026-10-06')
    const dayLate = introduced('2026-10-12')
    const future = introduced('2026-10-14')
    const { reviews } = dueToday([today, future, dayLate, weekLate], TODAY, 10)
    expect(reviews.map((p) => p.id)).toEqual([weekLate.id, dayLate.id, today.id])
  })

  it('releases new phrases oldest first, up to the cap', () => {
    const a = makePhrase({ created_at: '2026-10-01T00:00:00Z' })
    const b = makePhrase({ created_at: '2026-10-02T00:00:00Z' })
    const c = makePhrase({ created_at: '2026-10-03T00:00:00Z' })
    const { fresh } = dueToday([c, a, b], TODAY, 2)
    expect(fresh.map((p) => p.id)).toEqual([a.id, b.id])
  })

  it('counts phrases already introduced today against the cap', () => {
    const doneToday = [
      introduced('2026-10-14', { introduced_on: TODAY }),
      introduced('2026-10-14', { introduced_on: TODAY }),
    ]
    const queued = [makePhrase(), makePhrase(), makePhrase()]
    expect(dueToday([...doneToday, ...queued], TODAY, 3).fresh).toHaveLength(1)
  })

  it('releases no new phrases once today’s cap is used up', () => {
    const doneToday = Array.from({ length: 3 }, () =>
      introduced('2026-10-14', { introduced_on: TODAY }),
    )
    const queued = Array.from({ length: 20 }, () => makePhrase())
    expect(dueToday([...doneToday, ...queued], TODAY, 3).fresh).toEqual([])
  })

  it('releases nothing new with a cap of 0', () => {
    expect(dueToday([makePhrase()], TODAY, 0).fresh).toEqual([])
  })
})

describe('newAllowanceToday', () => {
  it('never goes negative when the cap was lowered after introducing more', () => {
    const doneToday = Array.from({ length: 5 }, () =>
      introduced('2026-10-14', { introduced_on: TODAY }),
    )
    expect(newAllowanceToday(doneToday, TODAY, 2)).toBe(0)
  })
})

describe('practiceSet', () => {
  it('picks introduced phrases not due today, soonest first, up to the size', () => {
    const soon = introduced('2026-10-14')
    const later = introduced('2026-10-20')
    const latest = introduced('2026-11-30')
    const dueNow = introduced('2026-10-13')
    const fresh = makePhrase()
    expect(practiceSet([latest, fresh, dueNow, later, soon], TODAY, 2).map((p) => p.id)).toEqual([
      soon.id,
      later.id,
    ])
  })

  it('defaults to 10 phrases', () => {
    const many = Array.from({ length: 15 }, (_, i) => introduced(`2026-11-${String(i + 1).padStart(2, '0')}`))
    expect(practiceSet(many, TODAY)).toHaveLength(10)
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bunx vitest run src/features/phrases/dailyQueue.test.ts`
Expected: FAIL. `./dailyQueue` doesn't resolve.

- [ ] **Step 4: Implement `dailyQueue.ts`**

`src/features/phrases/dailyQueue.ts`:

```ts
import type { DateKey, Phrase } from '@/types/phrase'

export const PRACTICE_SESSION_SIZE = 10

function byCreated(a: Phrase, b: Phrase): number {
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
}

function byDueThenCreated(a: Phrase, b: Phrase): number {
  return a.due_on!.localeCompare(b.due_on!) || byCreated(a, b)
}

/** How many more new phrases may be introduced today. */
export function newAllowanceToday(phrases: Phrase[], today: DateKey, cap: number): number {
  const introducedToday = phrases.filter((p) => p.introduced_on === today).length
  return Math.max(0, cap - introducedToday)
}

/**
 * Today's due session: scheduled phrases due today or earlier (overdue
 * rolls into today, most overdue first), then new phrases oldest-first up
 * to what's left of the daily cap.
 */
export function dueToday(
  phrases: Phrase[],
  today: DateKey,
  cap: number,
): { reviews: Phrase[]; fresh: Phrase[] } {
  const reviews = phrases.filter((p) => p.due_on !== null && p.due_on <= today).sort(byDueThenCreated)
  const fresh = phrases
    .filter((p) => p.due_on === null)
    .sort(byCreated)
    .slice(0, newAllowanceToday(phrases, today, cap))
  return { reviews, fresh }
}

/**
 * Practice-ahead: introduced phrases not yet due, soonest first. New phrases
 * stay in their queue so practice never sidesteps the daily cap.
 */
export function practiceSet(
  phrases: Phrase[],
  today: DateKey,
  size: number = PRACTICE_SESSION_SIZE,
): Phrase[] {
  return phrases
    .filter((p) => p.due_on !== null && p.due_on > today)
    .sort(byDueThenCreated)
    .slice(0, size)
}
```

- [ ] **Step 5: Run the queue tests**

Run: `bunx vitest run src/features/phrases/dailyQueue.test.ts`
Expected: PASS

- [ ] **Step 6: Write the failing forecast tests**

`src/features/phrases/forecast.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { forecast, nextBusyDay } from './forecast'
import { makePhrase } from './testPhrase'

const TODAY = '2026-10-13'

function scheduled(due_on: string, introduced_on = '2026-10-01') {
  return makePhrase({ due_on, introduced_on, interval_days: 3, reps: 2 })
}

describe('forecast', () => {
  it('returns one entry per day starting today', () => {
    const days = forecast([], TODAY, 10, 3)
    expect(days.map((d) => d.date)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15'])
  })

  it('counts overdue phrases on today, however late they are', () => {
    const days = forecast(
      [scheduled('2026-09-01'), scheduled('2026-10-12'), scheduled('2026-10-13')],
      TODAY,
      10,
      2,
    )
    expect(days[0]).toEqual({ date: TODAY, reviews: 3, newPhrases: 0 })
    expect(days[1].reviews).toBe(0)
  })

  it('counts scheduled reviews on their due dates', () => {
    const days = forecast([scheduled('2026-10-15'), scheduled('2026-10-15')], TODAY, 10, 4)
    expect(days[2]).toEqual({ date: '2026-10-15', reviews: 2, newPhrases: 0 })
  })

  it('releases queued new phrases at the cap, starting with what is left today', () => {
    const introducedToday = scheduled('2026-10-14', TODAY)
    const queued = Array.from({ length: 5 }, () => makePhrase())
    const days = forecast([introducedToday, ...queued], TODAY, 2, 5)
    expect(days.map((d) => d.newPhrases)).toEqual([1, 2, 2, 0, 0])
  })

  it('starts new phrases tomorrow when today’s cap is used up', () => {
    const doneToday = [scheduled('2026-10-14', TODAY), scheduled('2026-10-14', TODAY)]
    const queued = Array.from({ length: 20 }, () => makePhrase())
    const days = forecast([...doneToday, ...queued], TODAY, 2, 3)
    expect(days.map((d) => d.newPhrases)).toEqual([0, 2, 2])
  })
})

describe('nextBusyDay', () => {
  it('finds the first day after today with anything due', () => {
    const days = forecast([scheduled('2026-10-16')], TODAY, 10, 10)
    expect(nextBusyDay(days, TODAY)).toEqual({ date: '2026-10-16', reviews: 1, newPhrases: 0 })
  })

  it('is null when nothing is coming up', () => {
    expect(nextBusyDay(forecast([], TODAY, 10, 10), TODAY)).toBeNull()
  })
})
```

- [ ] **Step 7: Run it to verify it fails**

Run: `bunx vitest run src/features/phrases/forecast.test.ts`
Expected: FAIL. `./forecast` doesn't resolve.

- [ ] **Step 8: Implement `forecast.ts`**

`src/features/phrases/forecast.ts`:

```ts
import type { DateKey, Phrase } from '@/types/phrase'
import { newAllowanceToday } from './dailyQueue'
import { addDays } from './dates'

/** A little over a year, so the calendar can page ~12 months ahead. */
export const FORECAST_DAYS = 400

export interface ForecastDay {
  date: DateKey
  reviews: number
  newPhrases: number
}

/**
 * Due counts per day for the current schedule: scheduled reviews on their
 * due_on (overdue counted today), plus queued new phrases released at the
 * daily cap. It doesn't simulate future review outcomes.
 */
export function forecast(
  phrases: Phrase[],
  today: DateKey,
  cap: number,
  days: number,
): ForecastDay[] {
  const reviewsByDate = new Map<DateKey, number>()
  for (const phrase of phrases) {
    if (phrase.due_on === null) continue
    const date = phrase.due_on < today ? today : phrase.due_on
    reviewsByDate.set(date, (reviewsByDate.get(date) ?? 0) + 1)
  }

  let queued = phrases.filter((p) => p.due_on === null).length
  const result: ForecastDay[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i)
    const allowance = i === 0 ? newAllowanceToday(phrases, today, cap) : cap
    const newPhrases = Math.min(queued, allowance)
    queued -= newPhrases
    result.push({ date, reviews: reviewsByDate.get(date) ?? 0, newPhrases })
  }
  return result
}

/** The first day after today with anything due, for "Next 5 due Thursday". */
export function nextBusyDay(days: ForecastDay[], today: DateKey): ForecastDay | null {
  return days.find((d) => d.date > today && d.reviews + d.newPhrases > 0) ?? null
}
```

- [ ] **Step 9: Run all phrase tests**

Run: `bunx vitest run src/features/phrases/`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add src/features/phrases/dailyQueue.ts src/features/phrases/dailyQueue.test.ts src/features/phrases/forecast.ts src/features/phrases/forecast.test.ts src/features/phrases/testPhrase.ts
git commit -m "feat(phrases): select today's due phrases and forecast upcoming due counts" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Database migration

**Files:**
- Create: `supabase/migrations/0009_phrases.sql`

**Interfaces:**
- Consumes: existing `public.set_updated_at()`, `public.idioms`, `auth.users`
- Produces (later tasks rely on these exact names):
  - tables `public.phrases`, `public.phrase_reviews`, `public.user_settings` with the columns in `src/types/phrase.ts`
  - enums `public.phrase_rating`, `public.phrase_grade_source`
  - RPC `public.record_phrase_review(p_phrase_id uuid, p_reviewed_on date, p_rating phrase_rating, p_attempt_count integer, p_typed_answer text, p_grade_source phrase_grade_source, p_jev_verdict text, p_is_practice boolean, p_due_on date default null, p_interval_days integer default null, p_ease numeric default null, p_reps integer default null, p_lapses integer default null) returns void`
  - custom SQLSTATEs: `PR404` = phrase not found / not yours; `PR409` = a scheduled review for a phrase that isn't due (already recorded)
  - unique violation `23505` on `(owner_id, idiom_id)` when re-adding an idiom

- [ ] **Step 1: Write the migration**

`supabase/migrations/0009_phrases.sql`:

```sql
-- Phrase spaced repetition: one per-user phrase collection (independent of
-- study sets) reviewed on an SM-2-style schedule. See
-- docs/superpowers/specs/2026-10-13-phrase-spaced-repetition-design.md.
--
-- Scheduling math runs client-side; record_phrase_review persists a
-- review's log row and the phrase's new schedule in one transaction.
-- Practice-ahead reviews are logged but never touch the schedule -- that
-- rule is enforced here, not trusted to the client.

create type public.phrase_rating as enum ('again', 'hard', 'good');
create type public.phrase_grade_source as enum ('exact', 'jev', 'fallback');

-- ---------------------------------------------------------------------
-- phrases: content + schedule (one direction, so one schedule per phrase)
-- ---------------------------------------------------------------------
create table public.phrases (
  id uuid primary key default gen_random_uuid(),
  -- Always set server-side by the trigger below; never trust the client.
  owner_id uuid not null references auth.users (id) on delete cascade,
  spanish text not null check (btrim(spanish) <> ''),
  english text not null check (btrim(english) <> ''),
  example text,
  -- flashcard-images bucket, {owner_id}/phrases/{phrase_id}.{ext}
  image_path text,
  -- Set when added from the idiom list. Content is copied, not linked.
  idiom_id uuid references public.idioms (id) on delete set null,
  -- Schedule. due_on null = new, not yet introduced. Dates are the
  -- learner's local calendar dates, supplied by the client.
  due_on date,
  introduced_on date,
  interval_days integer not null default 0 check (interval_days >= 0),
  ease numeric(4, 2) not null default 2.00 check (ease >= 1.30),
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, idiom_id)
);

create index phrases_owner_id_due_on_idx on public.phrases (owner_id, due_on);

create trigger phrases_set_updated_at
  before update on public.phrases
  for each row
  execute function public.set_updated_at();

create or replace function public.set_phrase_owner_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.owner_id := auth.uid();
  if new.owner_id is null then
    raise exception 'must be signed in to add a phrase';
  end if;
  return new;
end;
$$;

revoke execute on function public.set_phrase_owner_id() from public;

create trigger phrases_set_owner_id
  before insert on public.phrases
  for each row
  execute function public.set_phrase_owner_id();

alter table public.phrases enable row level security;

create policy "phrases_select_own"
  on public.phrases for select
  using (owner_id = auth.uid());

create policy "phrases_insert_own"
  on public.phrases for insert
  with check (owner_id = auth.uid());

create policy "phrases_update_own"
  on public.phrases for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "phrases_delete_own"
  on public.phrases for delete
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- phrase_reviews: append-only log of every resolved phrase (due or practice)
-- ---------------------------------------------------------------------
create table public.phrase_reviews (
  id uuid primary key default gen_random_uuid(),
  phrase_id uuid not null references public.phrases (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  reviewed_on date not null,
  rating phrase_rating not null,
  attempt_count integer not null check (attempt_count between 1 and 3),
  typed_answer text not null check (char_length(typed_answer) <= 500),
  grade_source phrase_grade_source not null,
  jev_verdict text,
  -- Practice-ahead reviews: logged for history, never read by scheduling.
  -- Queries counting "reviews done today" must filter on this.
  is_practice boolean not null,
  created_at timestamptz not null default now()
);

create index phrase_reviews_phrase_id_idx on public.phrase_reviews (phrase_id);
create index phrase_reviews_owner_id_reviewed_on_idx
  on public.phrase_reviews (owner_id, reviewed_on);

-- Mirrors set_quiz_attempt_lineage: owner_id always comes from the phrase.
create or replace function public.set_phrase_review_lineage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select owner_id into new.owner_id
  from public.phrases
  where id = new.phrase_id;

  if new.owner_id is null then
    raise exception 'phrase_id % does not exist', new.phrase_id using errcode = 'PR404';
  end if;

  return new;
end;
$$;

revoke execute on function public.set_phrase_review_lineage() from public;

create trigger phrase_reviews_set_lineage
  before insert on public.phrase_reviews
  for each row
  execute function public.set_phrase_review_lineage();

alter table public.phrase_reviews enable row level security;

-- Append-only: select/insert only.
create policy "phrase_reviews_select_own"
  on public.phrase_reviews for select
  using (owner_id = auth.uid());

create policy "phrase_reviews_insert_own"
  on public.phrase_reviews for insert
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- user_settings: one row per user; a missing row means defaults
-- ---------------------------------------------------------------------
create table public.user_settings (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  new_phrases_per_day integer not null default 10 check (new_phrases_per_day between 0 and 100),
  updated_at timestamptz not null default now()
);

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row
  execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy "user_settings_select_own"
  on public.user_settings for select
  using (owner_id = auth.uid());

create policy "user_settings_insert_own"
  on public.user_settings for insert
  with check (owner_id = auth.uid());

create policy "user_settings_update_own"
  on public.user_settings for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------
-- record_phrase_review: log row + schedule update in one transaction
-- ---------------------------------------------------------------------
-- security invoker: RLS applies, so another user's phrase is "not found".
-- Errors the client handles:
--   PR404 -- phrase doesn't exist (or isn't yours); e.g. deleted mid-session.
--   PR409 -- scheduled review of a phrase that isn't due; the review was
--            already recorded (a retry or a second tab got there first).
create or replace function public.record_phrase_review(
  p_phrase_id uuid,
  p_reviewed_on date,
  p_rating public.phrase_rating,
  p_attempt_count integer,
  p_typed_answer text,
  p_grade_source public.phrase_grade_source,
  p_jev_verdict text,
  p_is_practice boolean,
  p_due_on date default null,
  p_interval_days integer default null,
  p_ease numeric default null,
  p_reps integer default null,
  p_lapses integer default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_due_on date;
begin
  select due_on into v_due_on
  from public.phrases
  where id = p_phrase_id
  for update;

  if not found then
    raise exception 'phrase % not found', p_phrase_id using errcode = 'PR404';
  end if;

  if not p_is_practice then
    if v_due_on is not null and v_due_on > p_reviewed_on then
      raise exception 'phrase % is not due until %', p_phrase_id, v_due_on
        using errcode = 'PR409';
    end if;
    if p_due_on is null or p_interval_days is null or p_ease is null
      or p_reps is null or p_lapses is null then
      raise exception 'a scheduled review needs the new schedule';
    end if;
  end if;

  insert into public.phrase_reviews (
    phrase_id, reviewed_on, rating, attempt_count, typed_answer,
    grade_source, jev_verdict, is_practice
  ) values (
    p_phrase_id, p_reviewed_on, p_rating, p_attempt_count, p_typed_answer,
    p_grade_source, p_jev_verdict, p_is_practice
  );

  if not p_is_practice then
    update public.phrases
    set due_on = p_due_on,
        interval_days = p_interval_days,
        ease = p_ease,
        reps = p_reps,
        lapses = p_lapses,
        introduced_on = coalesce(introduced_on, p_reviewed_on)
    where id = p_phrase_id;
  end if;
end;
$$;

revoke execute on function public.record_phrase_review(
  uuid, date, public.phrase_rating, integer, text, public.phrase_grade_source,
  text, boolean, date, integer, numeric, integer, integer
) from public, anon;

grant execute on function public.record_phrase_review(
  uuid, date, public.phrase_rating, integer, text, public.phrase_grade_source,
  text, boolean, date, integer, numeric, integer, integer
) to authenticated;
```

- [ ] **Step 2: Apply it locally**

Run: `bun run db:start` (skip if it's already running), then `bun run db:reset`
Expected: the reset finishes without errors and replays `0009_phrases.sql`.

- [ ] **Step 3: Verify RLS, ownership, and the RPC rules**

Run this script against the local database. It rolls back, so nothing persists.

```bash
docker exec -i supabase_db_escritorio psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL'
begin;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

-- A spoofed owner_id is overwritten with the caller.
insert into public.phrases (id, owner_id, spanish, english)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', 'meter la pata', 'to blunder');
do $$ begin
  assert (select owner_id from public.phrases where id = '10000000-0000-0000-0000-000000000001')
    = '00000000-0000-0000-0000-0000000000a1', 'owner_id was not forced to the caller';
end $$;

-- Practice: logged, schedule untouched.
select public.record_phrase_review('10000000-0000-0000-0000-000000000001', '2026-10-13', 'good', 1, 'meter la pata', 'exact', null, true);
do $$ begin
  assert (select due_on is null and reps = 0 and introduced_on is null from public.phrases
          where id = '10000000-0000-0000-0000-000000000001'), 'practice changed the schedule';
  assert (select count(*) = 1 and bool_and(is_practice) from public.phrase_reviews), 'practice review not logged';
end $$;

-- Scheduled: logged + schedule updated + introduced_on set.
select public.record_phrase_review('10000000-0000-0000-0000-000000000001', '2026-10-13', 'good', 1, 'meter la pata', 'exact', null, false,
                                   '2026-10-14', 1, 2.00, 1, 0);
do $$ begin
  assert (select due_on = '2026-10-14' and introduced_on = '2026-10-13' and reps = 1
          from public.phrases where id = '10000000-0000-0000-0000-000000000001'), 'schedule not updated';
end $$;

-- A duplicate scheduled review of a not-yet-due phrase is refused with PR409.
do $$ begin
  perform public.record_phrase_review('10000000-0000-0000-0000-000000000001', '2026-10-13', 'good', 1, 'meter la pata', 'exact', null, false,
                                      '2026-10-16', 3, 2.00, 2, 0);
  raise exception 'expected PR409';
exception when sqlstate 'PR409' then null;
end $$;

-- Settings: own row can be created and read.
insert into public.user_settings (new_phrases_per_day) values (5);
do $$ begin
  assert (select new_phrases_per_day from public.user_settings) = 5, 'settings not saved';
end $$;

-- Another user sees nothing and can't review a's phrase (PR404).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
do $$ begin
  assert (select count(*) from public.phrases) = 0, 'b can see a''s phrases';
  assert (select count(*) from public.phrase_reviews) = 0, 'b can see a''s reviews';
  assert (select count(*) from public.user_settings) = 0, 'b can see a''s settings';
end $$;
do $$ begin
  perform public.record_phrase_review('10000000-0000-0000-0000-000000000001', '2026-10-20', 'good', 1, 'x', 'exact', null, true);
  raise exception 'expected PR404';
exception when sqlstate 'PR404' then null;
end $$;

rollback;
SQL
```

Expected: the script ends with `ROLLBACK` and reports no `ERROR` or failed `ASSERT`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0009_phrases.sql
git commit -m "feat(db): add phrases, phrase_reviews, user_settings, and record_phrase_review" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `grade-phrase` Edge Function, client caller, and deploy workflow

**Files:**
- Create: `supabase/functions/grade-phrase/jev.ts`
- Create: `supabase/functions/grade-phrase/jev_test.ts`
- Create: `supabase/functions/grade-phrase/index.ts`
- Create: `src/api/gradePhrase.ts`
- Create: `.github/workflows/deploy-functions.yml`
- Modify: `README.md` (add an "Edge Functions" section after the migrations section)

**Interfaces:**
- Consumes: `JevGrader`, `JevGrade` from `@/features/phrases/grading` (Task 2)
- Produces:
  - HTTP `POST /functions/v1/grade-phrase`, body `{ english, expected, typed }` → `200 { verdict, confidence }`. Body `{ warmup: true }` → `204`. `400` for an invalid body, `502` when Jev fails, `503` when the secret is missing.
  - `callGradePhrase: JevGrader` and `warmUpGrader(): void` from `src/api/gradePhrase.ts`

The function can't import from `src/` (Deno, separate deploy), so `jev.ts` keeps its own copy of the verdict list. It must stay in sync with `JevVerdict` in `src/types/phrase.ts`.

- [ ] **Step 1: Write the failing Deno tests**

`supabase/functions/grade-phrase/jev_test.ts`:

```ts
import { assertEquals } from 'jsr:@std/assert@1'
import { buildJevPayload, parseGradeRequest, parseJevResponse } from './jev.ts'

Deno.test('parseGradeRequest accepts three non-empty strings', () => {
  assertEquals(parseGradeRequest({ english: 'to blunder', expected: 'meter la pata', typed: 'meter la pta' }), {
    english: 'to blunder',
    expected: 'meter la pata',
    typed: 'meter la pta',
  })
})

Deno.test('parseGradeRequest rejects missing, blank, non-string, or oversized fields', () => {
  assertEquals(parseGradeRequest(null), null)
  assertEquals(parseGradeRequest({ english: 'a', expected: 'b' }), null)
  assertEquals(parseGradeRequest({ english: 'a', expected: 'b', typed: '  ' }), null)
  assertEquals(parseGradeRequest({ english: 'a', expected: 2, typed: 'c' }), null)
  assertEquals(parseGradeRequest({ english: 'a', expected: 'b', typed: 'x'.repeat(501) }), null)
})

Deno.test('buildJevPayload asks one choice question over the four verdicts', () => {
  const payload = buildJevPayload({ english: 'to blunder', expected: 'meter la pata', typed: 'meter la pta' })
  assertEquals(payload.model, 'jev-latest')
  assertEquals(payload.state, {
    english_prompt: 'to blunder',
    expected_spanish: 'meter la pata',
    learner_typed: 'meter la pta',
  })
  assertEquals(payload.questions.verdict.type, 'choice')
  assertEquals(Object.keys(payload.questions.verdict.criteria), [
    'exact',
    'minor_slip',
    'valid_variant',
    'wrong',
  ])
})

Deno.test('parseJevResponse reads the verdict answer', () => {
  assertEquals(
    parseJevResponse({
      model: 'jev-1.13',
      answers: { verdict: { type: 'choice', choice: 'minor_slip', probabilities: {}, confidence: 0.82 } },
    }),
    { verdict: 'minor_slip', confidence: 0.82 },
  )
})

Deno.test('parseJevResponse rejects unknown choices or malformed bodies', () => {
  assertEquals(parseJevResponse({ answers: { verdict: { choice: 'maybe', confidence: 0.9 } } }), null)
  assertEquals(parseJevResponse({ answers: { verdict: { choice: 'exact' } } }), null)
  assertEquals(parseJevResponse({}), null)
  assertEquals(parseJevResponse(null), null)
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `deno test supabase/functions/grade-phrase/`
Expected: FAIL. `./jev.ts` can't be found.

- [ ] **Step 3: Implement `jev.ts`**

`supabase/functions/grade-phrase/jev.ts`:

```ts
// Pure request/response mapping for the grade-phrase function, kept apart
// from Deno.serve so it can be unit-tested. The verdict list mirrors
// JevVerdict in src/types/phrase.ts -- keep them in sync.

export const JEV_URL = 'https://api.typesafe.ai/v1/systemone'
export const JEV_MODEL = 'jev-latest'
export const MAX_FIELD_LENGTH = 500

export const VERDICTS = ['exact', 'minor_slip', 'valid_variant', 'wrong'] as const
export type Verdict = (typeof VERDICTS)[number]

export interface GradeRequest {
  english: string
  expected: string
  typed: string
}

export interface GradeResponse {
  verdict: Verdict
  confidence: number
}

function isField(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_FIELD_LENGTH
}

export function parseGradeRequest(body: unknown): GradeRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const { english, expected, typed } = body as Record<string, unknown>
  if (!isField(english) || !isField(expected) || !isField(typed)) return null
  return { english, expected, typed }
}

export function buildJevPayload(request: GradeRequest) {
  return {
    model: JEV_MODEL,
    state: {
      english_prompt: request.english,
      expected_spanish: request.expected,
      learner_typed: request.typed,
    },
    questions: {
      verdict: {
        type: 'choice' as const,
        instructions:
          'A Spanish learner saw english_prompt and typed the Spanish phrase from memory as ' +
          'learner_typed. The answer key is expected_spanish. How should learner_typed be graded?',
        criteria: {
          exact: {
            what: 'The same phrase as expected_spanish, ignoring capitalization, punctuation and spacing.',
            examples: ['expected "meter la pata", typed "Meter la pata."'],
          },
          minor_slip: {
            what:
              'The intended phrase with a small mechanical error: a missing or wrong accent, ' +
              'a one-letter typo, or a dropped or wrong article.',
            not_for: 'A different word, a wrong verb, or a change that alters the meaning.',
            examples: [
              'expected "llover a cántaros", typed "llover a cantaros"',
              'expected "meter la pata", typed "meter la pta"',
              'expected "echar una mano", typed "echar mano"',
            ],
          },
          valid_variant: {
            what:
              'Different wording that a native speaker would accept as the same idiom with the ' +
              'same meaning, such as a common regional variant.',
            not_for:
              'A literal word-for-word translation of the English that is not idiomatic Spanish, ' +
              'or a different idiom with a different meaning.',
            examples: ['expected "costar un ojo de la cara", typed "valer un ojo de la cara"'],
          },
          wrong: {
            what:
              'Anything else: a different phrase, a literal translation, missing key words, ' +
              'or unrelated text.',
            examples: [
              'expected "meter la pata", typed "poner el pie"',
              'expected "tomar el pelo", typed "tirar del pelo"',
            ],
          },
        },
      },
    },
  }
}

export function parseJevResponse(json: unknown): GradeResponse | null {
  const answer = (json as { answers?: { verdict?: { choice?: unknown; confidence?: unknown } } } | null)
    ?.answers?.verdict
  if (!answer) return null
  const { choice, confidence } = answer
  if (!VERDICTS.includes(choice as Verdict) || typeof confidence !== 'number') return null
  return { verdict: choice as Verdict, confidence }
}
```

- [ ] **Step 4: Run the Deno tests**

Run: `deno test supabase/functions/grade-phrase/`
Expected: PASS (5 tests)

- [ ] **Step 5: Implement the handler**

`supabase/functions/grade-phrase/index.ts`:

```ts
// grade-phrase: a stateless proxy that asks Jev whether a typed Spanish
// phrase is acceptable, keeping TYPESAFE_API_KEY off the client. Callers
// must be signed in (Supabase verifies the JWT before this runs). It never
// touches the database. See the phrase spaced repetition spec.

import { buildJevPayload, JEV_URL, parseGradeRequest, parseJevResponse } from './jev.ts'

// Below the client's 4 s budget, so the client sees a clean 502 rather
// than its own timeout.
const JEV_FETCH_TIMEOUT_MS = 3500

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = await req.json().catch(() => null)

  // Sent once at session start so a cold start doesn't eat into the first
  // real grade's timeout.
  if (body?.warmup === true) return new Response(null, { status: 204, headers: corsHeaders })

  const request = parseGradeRequest(body)
  if (!request) return json({ error: 'invalid request' }, 400)

  const apiKey = Deno.env.get('TYPESAFE_API_KEY')
  if (!apiKey) return json({ error: 'grading unavailable' }, 503)

  const response = await fetch(JEV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildJevPayload(request)),
    signal: AbortSignal.timeout(JEV_FETCH_TIMEOUT_MS),
  }).catch((error) => {
    console.error('Jev request failed:', error)
    return null
  })

  if (!response?.ok) {
    if (response) console.error('Jev responded', response.status, await response.text().catch(() => ''))
    return json({ error: 'grader failed' }, 502)
  }

  const grade = parseJevResponse(await response.json().catch(() => null))
  if (!grade) return json({ error: 'grader failed' }, 502)
  return json(grade, 200)
})
```

- [ ] **Step 6: Add the client caller**

`src/api/gradePhrase.ts`:

```ts
import type { JevGrade, JevGrader } from '@/features/phrases/grading'
import { supabase } from '@/lib/supabase'

/** Calls the grade-phrase Edge Function. Throws on any failure; gradePhrase falls back. */
export const callGradePhrase: JevGrader = async (request, signal) => {
  const { data, error } = await supabase.functions.invoke<JevGrade>('grade-phrase', {
    body: request,
    signal,
  })
  if (error) throw error
  if (!data) throw new Error('grade-phrase returned no body')
  return data
}

/** Fire-and-forget: wakes a cold function so the first real grade is fast. */
export function warmUpGrader(): void {
  supabase.functions.invoke('grade-phrase', { body: { warmup: true } }).catch(() => {})
}
```

- [ ] **Step 7: Add the deploy workflow**

`.github/workflows/deploy-functions.yml`:

```yaml
name: Deploy Edge Functions

# The Supabase GitHub integration only deploys functions declared in a
# committed supabase/config.toml, which this repo deliberately doesn't
# commit (see README), so functions deploy from here instead.

on:
  push:
    branches: [develop]
    paths: ['supabase/functions/**']
  workflow_dispatch:

concurrency:
  group: edge-functions
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x

      - run: deno test supabase/functions/grade-phrase/

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      # Local CLI settings only; functions deploy doesn't push project config.
      - run: cp supabase/config.local.toml supabase/config.toml

      - run: supabase functions deploy grade-phrase --project-ref "$SUPABASE_PROJECT_REF"
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
```

- [ ] **Step 8: Document it in the README**

In `README.md`, insert the following section directly after the paragraph that ends "...or the integration will try to apply it again and fail." (around line 40):

```markdown
## Edge Functions

`supabase/functions/` holds Supabase Edge Functions (Deno). They're deployed by
`.github/workflows/deploy-functions.yml` on merge to `develop`, not by the Supabase
GitHub integration (it only deploys functions declared in a committed `config.toml`,
which we don't commit).

One-time setup:

- GitHub repo secrets `SUPABASE_ACCESS_TOKEN` (a Supabase personal access token) and
  `SUPABASE_PROJECT_REF`.
- The TypeSafe key as a function secret: `bunx supabase secrets set TYPESAFE_API_KEY=… --project-ref <ref>`
  (or Dashboard → Edge Functions → Secrets). It never goes in `.env.local` or GitHub.

Locally, put `TYPESAFE_API_KEY=…` in `supabase/functions/.env.local` (git-ignored) and run
`bunx supabase functions serve grade-phrase --env-file supabase/functions/.env.local`
alongside `bun run db:start`. Tests: `deno test supabase/functions/grade-phrase/`.
```

- [ ] **Step 9: Smoke-test the function locally**

Run (in a second terminal, with the local stack running and a real key in `supabase/functions/.env.local`):

```bash
bunx supabase functions serve grade-phrase --env-file supabase/functions/.env.local
```

Then sign in to the local app once (`bun run dev`), copy the access token from devtools (`localStorage` → `sb-127-auth-token` → `access_token`), and run:

```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/grade-phrase \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"english":"to rain cats and dogs","expected":"llover a cántaros","typed":"llover a cantaros"}'
```

Expected: `{"verdict":"minor_slip","confidence":…}` (or another verdict with a confidence). Repeating the request without the `Authorization` header should return `401`.

- [ ] **Step 10: Typecheck and commit**

Run: `bun run build`
Expected: succeeds (`src/api/gradePhrase.ts` typechecks; `supabase/functions` isn't part of the app's tsconfig).

```bash
git add supabase/functions/grade-phrase src/api/gradePhrase.ts .github/workflows/deploy-functions.yml README.md
git commit -m "feat(phrases): add grade-phrase Edge Function proxying Jev, with deploy workflow" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Extract `TypedAnswerQuiz` and rebuild `QuizCard` on it

**Files:**
- Create: `src/components/typedAnswerState.ts`
- Create: `src/components/typedAnswerState.test.ts`
- Create: `src/components/TypedAnswerQuiz.tsx`
- Modify: `src/features/study/QuizCard.tsx` (full rewrite below; external props unchanged)

**Interfaces:**
- Consumes: `AccentedCharPad`, `useCursorInsert`, shadcn `Button`/`Input`/`Label`
- Produces:
  - `MAX_ATTEMPTS = 3`
  - `interface GradeOutcome { correct: boolean; note?: string | null }`
  - `interface Resolution<G> { correct: boolean; attemptCount: number; typed: string; outcome: G }`
  - `type Feedback`, `interface AnswerState`, `INITIAL_ANSWER_STATE`, `isLocked(state)`, `applyGrade(state, typed, outcome)`
  - `<TypedAnswerQuiz<G extends GradeOutcome> prompt expectedAnswer showAccentPad grade onResolved onNext />`

Behavior must not change for study-set sessions: same 3 attempts, same messages, the input clears on retry, and `onCorrect` plus the attempt log fire at the same moments.

- [ ] **Step 1: Write the failing state tests**

`src/components/typedAnswerState.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  applyGrade,
  INITIAL_ANSWER_STATE,
  isLocked,
  MAX_ATTEMPTS,
  type GradeOutcome,
  type Resolution,
} from './typedAnswerState'

const right = { correct: true }
const wrong = { correct: false }

describe('applyGrade', () => {
  it('resolves correct on the first try', () => {
    const { state, resolution } = applyGrade(INITIAL_ANSWER_STATE, 'hola', right)
    expect(state.feedback).toEqual({ kind: 'correct', note: null })
    expect(isLocked(state)).toBe(true)
    expect(resolution).toEqual({ correct: true, attemptCount: 1, typed: 'hola', outcome: right })
  })

  it('carries the outcome note into the correct feedback', () => {
    const outcome = { correct: true, note: 'Accepted. Exact form: hola' }
    expect(applyGrade(INITIAL_ANSWER_STATE, 'ola', outcome).state.feedback).toEqual({
      kind: 'correct',
      note: 'Accepted. Exact form: hola',
    })
  })

  it('asks for a retry with the attempts left, without resolving', () => {
    const { state, resolution } = applyGrade(INITIAL_ANSWER_STATE, 'x', wrong)
    expect(state).toEqual({ attempts: 1, feedback: { kind: 'retry', attemptsLeft: MAX_ATTEMPTS - 1 } })
    expect(isLocked(state)).toBe(false)
    expect(resolution).toBeNull()
  })

  it('reveals after the third miss and resolves incorrect', () => {
    let state = INITIAL_ANSWER_STATE
    let resolution: Resolution<GradeOutcome> | null = null
    for (const typed of ['a', 'b', 'c']) {
      ;({ state, resolution } = applyGrade(state, typed, wrong))
    }
    expect(state.feedback).toEqual({ kind: 'revealed' })
    expect(isLocked(state)).toBe(true)
    expect(resolution).toEqual({ correct: false, attemptCount: 3, typed: 'c', outcome: wrong })
  })

  it('counts the attempt a late correct answer landed on', () => {
    const afterMiss = applyGrade(INITIAL_ANSWER_STATE, 'x', wrong).state
    expect(applyGrade(afterMiss, 'hola', right).resolution?.attemptCount).toBe(2)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run src/components/typedAnswerState.test.ts`
Expected: FAIL. `./typedAnswerState` doesn't resolve.

- [ ] **Step 3: Implement the state machine**

`src/components/typedAnswerState.ts`:

```ts
export const MAX_ATTEMPTS = 3

export interface GradeOutcome {
  correct: boolean
  /** Shown in place of "Correct!" (e.g. the exact form after a near miss). */
  note?: string | null
}

export type Feedback =
  | { kind: 'correct'; note: string | null }
  | { kind: 'retry'; attemptsLeft: number }
  | { kind: 'revealed' }

export interface AnswerState {
  attempts: number
  feedback: Feedback | null
}

/** A question is resolved when it's answered correctly or revealed. */
export interface Resolution<G> {
  correct: boolean
  attemptCount: number
  typed: string
  outcome: G
}

export const INITIAL_ANSWER_STATE: AnswerState = { attempts: 0, feedback: null }

export function isLocked(state: AnswerState): boolean {
  return state.feedback?.kind === 'correct' || state.feedback?.kind === 'revealed'
}

/**
 * One graded attempt. A wrong answer gets up to MAX_ATTEMPTS tries before
 * revealing; only a correct answer or the final miss resolves the question.
 */
export function applyGrade<G extends GradeOutcome>(
  state: AnswerState,
  typed: string,
  outcome: G,
): { state: AnswerState; resolution: Resolution<G> | null } {
  const attempts = state.attempts + 1
  if (outcome.correct) {
    return {
      state: { attempts, feedback: { kind: 'correct', note: outcome.note ?? null } },
      resolution: { correct: true, attemptCount: attempts, typed, outcome },
    }
  }
  if (attempts >= MAX_ATTEMPTS) {
    return {
      state: { attempts, feedback: { kind: 'revealed' } },
      resolution: { correct: false, attemptCount: attempts, typed, outcome },
    }
  }
  return {
    state: { attempts, feedback: { kind: 'retry', attemptsLeft: MAX_ATTEMPTS - attempts } },
    resolution: null,
  }
}
```

- [ ] **Step 4: Run the state tests**

Run: `bunx vitest run src/components/typedAnswerState.test.ts`
Expected: PASS

- [ ] **Step 5: Create the dumb component**

`src/components/TypedAnswerQuiz.tsx`:

```tsx
import { useState, type FormEvent, type ReactNode } from 'react'
import { AccentedCharPad } from '@/components/AccentedCharPad'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCursorInsert } from '@/hooks/useCursorInsert'
import {
  applyGrade,
  INITIAL_ANSWER_STATE,
  isLocked,
  type AnswerState,
  type GradeOutcome,
  type Resolution,
} from './typedAnswerState'

/**
 * A typed-answer question: caller-supplied prompt, an answer input, and
 * attempt/feedback handling (see applyGrade). Grading is delegated to
 * `grade`, which may be async (e.g. a network grader) and must not reject.
 * Mount fresh per question (parent keys it) so local state resets.
 */
export function TypedAnswerQuiz<G extends GradeOutcome>({
  prompt,
  expectedAnswer,
  showAccentPad,
  grade,
  onResolved,
  onNext,
}: {
  prompt: ReactNode
  expectedAnswer: string
  showAccentPad: boolean
  grade: (typed: string) => Promise<G>
  onResolved: (resolution: Resolution<G>) => void
  onNext: () => void
}) {
  const [value, setValue] = useState('')
  const [state, setState] = useState<AnswerState>(INITIAL_ANSWER_STATE)
  const [checking, setChecking] = useState(false)

  const cursor = useCursorInsert(() => value, setValue)
  const locked = isLocked(state)
  const feedback = state.feedback

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (locked) {
      onNext()
      return
    }
    if (checking) return

    const typed = value
    setChecking(true)
    const outcome = await grade(typed)
    setChecking(false)

    const { state: next, resolution } = applyGrade(state, typed, outcome)
    setState(next)
    if (resolution) onResolved(resolution)
    else setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {prompt}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quiz-answer">Your answer</Label>
        {showAccentPad && <AccentedCharPad onInsert={locked ? () => {} : cursor.insert} />}
        <Input
          id="quiz-answer"
          autoComplete="off"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          readOnly={locked || checking}
          className={locked ? 'text-muted-foreground' : undefined}
          ref={(el) => cursor.setRef(el)}
        />
      </div>

      <div aria-live="polite">
        {feedback?.kind === 'correct' && (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {feedback.note ?? 'Correct!'}
          </p>
        )}
        {feedback?.kind === 'retry' && (
          <p className="text-destructive text-sm font-medium">
            Not quite. {feedback.attemptsLeft} attempt{feedback.attemptsLeft === 1 ? '' : 's'} left.
          </p>
        )}
        {feedback?.kind === 'revealed' && (
          <p className="text-destructive text-sm font-medium">
            Not quite. The answer was: {expectedAnswer}
          </p>
        )}
      </div>

      <Button type="submit" disabled={checking}>
        {locked ? 'Next' : checking ? 'Checking…' : 'Check'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 6: Rewrite `QuizCard` as a thin wrapper**

Replace the full contents of `src/features/study/QuizCard.tsx` with:

```tsx
import { useState } from 'react'
import { TypedAnswerQuiz } from '@/components/TypedAnswerQuiz'
import { isAnswerCorrect } from '@/lib/grading'
import type { Question } from './studyMode'
import { useLogQuizAttempt } from './hooks/useLogQuizAttempt'

/**
 * One study-set quiz question: the prompt (conversion mode's word, or
 * meaning mode's image/definition) on top of TypedAnswerQuiz, graded by
 * exact match and logged to quiz_attempts. Mount fresh per card (parent
 * keys it by card.id) so all local state resets between cards.
 */
export function QuizCard({
  question,
  imageUrl,
  sessionId,
  onCorrect,
  onNext,
}: {
  question: Question
  imageUrl: string | undefined
  sessionId: string | null
  onCorrect: () => void
  onNext: () => void
}) {
  const { card } = question
  const [hintShown, setHintShown] = useState(false)
  const logAttempt = useLogQuizAttempt()

  const prompt = (
    <>
      {question.showImage && card.image_path && (
        <div className="bg-muted/30 flex min-h-48 items-center justify-center overflow-hidden rounded-lg border">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              decoding="async"
              className="max-h-72 w-full object-contain"
            />
          ) : (
            <p className="text-muted-foreground p-8 text-sm">Loading image…</p>
          )}
        </div>
      )}

      {question.showDefinition && card.definition && (
        <div
          className={
            !(question.showImage && card.image_path)
              ? 'bg-muted/30 flex min-h-48 items-center justify-center overflow-hidden rounded-lg border p-6'
              : undefined
          }
        >
          <p className="text-base leading-relaxed">{card.definition}</p>
        </div>
      )}

      {!question.showImage && !question.showDefinition && (
        <div className="bg-muted/30 flex min-h-32 items-center justify-center overflow-hidden rounded-lg border p-6">
          <p className="text-xl font-medium">{question.prompt}</p>
        </div>
      )}

      {card.hint &&
        (hintShown ? (
          <p className="text-muted-foreground text-sm">Hint: {card.hint}</p>
        ) : (
          <button
            type="button"
            className="text-muted-foreground self-start text-sm underline underline-offset-2"
            onClick={() => setHintShown(true)}
          >
            Show hint
          </button>
        ))}
    </>
  )

  return (
    <TypedAnswerQuiz
      prompt={prompt}
      expectedAnswer={question.expectedAnswer}
      showAccentPad={question.answerLanguage === 'es'}
      grade={async (typed) => ({ correct: isAnswerCorrect(typed, question.expectedAnswer) })}
      onResolved={({ correct, attemptCount }) => {
        logAttempt.mutate({
          card_id: card.id,
          is_correct: correct,
          attempt_count: attemptCount,
          session_id: sessionId,
          resolved_direction: question.resolvedDirection,
        })
        if (correct) onCorrect()
      }}
      onNext={onNext}
    />
  )
}
```

- [ ] **Step 7: Verify nothing regressed**

Run: `bun run test && bun run lint && bun run build`
Expected: all pass.

Then run `bun run dev`, open any study set, and start a session. Check the following:
- a correct answer shows "Correct!" and "Next"
- a wrong answer shows "Not quite. 2 attempts left." and clears the input
- three misses reveal the answer
- the accent pad inserts at the cursor
- "Show hint" works
- the end-of-deck screen appears

- [ ] **Step 8: Commit**

```bash
git add src/components/typedAnswerState.ts src/components/typedAnswerState.test.ts src/components/TypedAnswerQuiz.tsx src/features/study/QuizCard.tsx
git commit -m "refactor(study): extract TypedAnswerQuiz from QuizCard for reuse" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Phrase data layer (API modules and query hooks)

**Files:**
- Modify: `src/api/cardImages.ts` (add `phraseImagePath`)
- Create: `src/api/cardImages.test.ts`
- Create: `src/api/phrases.ts`
- Create: `src/api/userSettings.ts`
- Create: `src/api/phraseReviews.ts`
- Create: `src/features/phrases/hooks/usePhrases.ts`
- Create: `src/features/phrases/hooks/useUserSettings.ts`
- Create: `src/features/phrases/hooks/useRecordPhraseReview.ts`

**Interfaces:**
- Consumes: Task 1 types, Task 2 `JevVerdict`/`PhraseGradeSource`, Task 1 `ScheduleUpdate`, Task 4 table/RPC names and SQLSTATEs, existing `uploadCardImage`/`deleteCardImages`/`optimizeImage`
- Produces:
  - `phraseImagePath(ownerId: string, phraseId: string, filename: string): string`
  - `listPhrases(): Promise<Phrase[]>`, `createPhrase(id, input: PhraseInput)`, `updatePhrase(id, input: Partial<PhraseInput>)`, `deletePhrase(id)`, `addIdiomAsPhrase(idiom: Idiom): Promise<void>`
  - `DEFAULT_NEW_PHRASES_PER_DAY = 10`, `getUserSettings(): Promise<UserSettings>`, `updateNewPhrasesPerDay(ownerId: string, value: number)`
  - `class PhraseNotFoundError`, `interface RecordPhraseReviewInput`, `recordPhraseReview(input): Promise<void>`
  - hooks: `phrasesKey()`, `usePhrases()`, `interface PhraseFormInput`, `useCreatePhrase(ownerId)`, `useUpdatePhrase(ownerId)`, `useDeletePhrase()`, `useAddIdiomToPhrases()`, `userSettingsKey()`, `useUserSettings()`, `useUpdateNewPhrasesPerDay(ownerId)`, `useRecordPhraseReview()`

- [ ] **Step 1: Write the failing path test**

`src/api/cardImages.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { cardImagePath, phraseImagePath } from './cardImages'

// Hoisted above the import: the real client throws without VITE_SUPABASE_* env.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

describe('image paths', () => {
  it('keeps card images at the owner root', () => {
    expect(cardImagePath('owner', 'card', 'photo.JPG')).toBe('owner/card.jpg')
  })

  it('puts phrase images in a phrases/ folder under the owner', () => {
    expect(phraseImagePath('owner', 'phrase', 'photo.webp')).toBe('owner/phrases/phrase.webp')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bunx vitest run src/api/cardImages.test.ts`
Expected: FAIL. `phraseImagePath` is not a function.

- [ ] **Step 3: Add `phraseImagePath`**

In `src/api/cardImages.ts`, add this directly after `cardImagePath`:

```ts
// Phrase images share the bucket; the storage policies only check that the
// first folder is the owner's id, so a phrases/ subfolder needs no new policy.
export function phraseImagePath(ownerId: string, phraseId: string, filename: string): string {
  return `${ownerId}/phrases/${phraseId}.${extensionOf(filename)}`
}
```

Run: `bunx vitest run src/api/cardImages.test.ts`
Expected: PASS

- [ ] **Step 4: Create the API modules**

`src/api/phrases.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { Idiom } from '@/types/idiom'
import type { Phrase, PhraseInput } from '@/types/phrase'

const UNIQUE_VIOLATION = '23505'

// PostgREST may return numeric columns as strings; ease is numeric(4,2).
function toPhrase(row: Phrase): Phrase {
  return { ...row, ease: Number(row.ease) }
}

export async function listPhrases(): Promise<Phrase[]> {
  const { data, error } = await supabase
    .from('phrases')
    .select('*')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data.map(toPhrase)
}

export async function createPhrase(id: string, input: PhraseInput): Promise<Phrase> {
  const { data, error } = await supabase
    .from('phrases')
    .insert({ id, ...input })
    .select('*')
    .single()
  if (error) throw error
  return toPhrase(data)
}

export async function updatePhrase(id: string, input: Partial<PhraseInput>): Promise<Phrase> {
  const { data, error } = await supabase
    .from('phrases')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return toPhrase(data)
}

export async function deletePhrase(id: string): Promise<void> {
  const { error } = await supabase.from('phrases').delete().eq('id', id)
  if (error) throw error
}

/** Copies an idiom into the collection. Adding one that's already there is a no-op. */
export async function addIdiomAsPhrase(idiom: Idiom): Promise<void> {
  const { error } = await supabase.from('phrases').insert({
    spanish: idiom.spanish,
    english: idiom.english,
    example: idiom.example,
    idiom_id: idiom.id,
  })
  if (error && error.code !== UNIQUE_VIOLATION) throw error
}
```

`src/api/userSettings.ts`:

```ts
import { supabase } from '@/lib/supabase'
import type { UserSettings } from '@/types/phrase'

export const DEFAULT_NEW_PHRASES_PER_DAY = 10

/** A user without a settings row gets the defaults. */
export async function getUserSettings(): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('new_phrases_per_day')
    .maybeSingle()
  if (error) throw error
  return { new_phrases_per_day: data?.new_phrases_per_day ?? DEFAULT_NEW_PHRASES_PER_DAY }
}

export async function updateNewPhrasesPerDay(ownerId: string, value: number): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ owner_id: ownerId, new_phrases_per_day: value })
  if (error) throw error
}
```

`src/api/phraseReviews.ts`:

```ts
import type { ScheduleUpdate } from '@/features/phrases/scheduler'
import { supabase } from '@/lib/supabase'
import type { DateKey, JevVerdict, PhraseGradeSource, PhraseRating } from '@/types/phrase'

/** The phrase was deleted (or isn't yours) -- nothing to save. */
export class PhraseNotFoundError extends Error {}

export interface RecordPhraseReviewInput {
  phraseId: string
  reviewedOn: DateKey
  rating: PhraseRating
  attemptCount: number
  typedAnswer: string
  gradeSource: PhraseGradeSource
  jevVerdict: JevVerdict | null
  isPractice: boolean
  /** Required unless isPractice; ignored by the database for practice. */
  schedule: ScheduleUpdate | null
}

export async function recordPhraseReview(input: RecordPhraseReviewInput): Promise<void> {
  const { error } = await supabase.rpc('record_phrase_review', {
    p_phrase_id: input.phraseId,
    p_reviewed_on: input.reviewedOn,
    p_rating: input.rating,
    p_attempt_count: input.attemptCount,
    p_typed_answer: input.typedAnswer.slice(0, 500),
    p_grade_source: input.gradeSource,
    p_jev_verdict: input.jevVerdict,
    p_is_practice: input.isPractice,
    p_due_on: input.schedule?.due_on ?? null,
    p_interval_days: input.schedule?.interval_days ?? null,
    p_ease: input.schedule?.ease ?? null,
    p_reps: input.schedule?.reps ?? null,
    p_lapses: input.schedule?.lapses ?? null,
  })
  if (!error) return
  // Not due any more: a retry or another tab already recorded this review.
  if (error.code === 'PR409') return
  if (error.code === 'PR404') throw new PhraseNotFoundError(error.message)
  throw error
}
```

- [ ] **Step 5: Create the hooks**

`src/features/phrases/hooks/usePhrases.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteCardImages, phraseImagePath, uploadCardImage } from '@/api/cardImages'
import { addIdiomAsPhrase, createPhrase, deletePhrase, listPhrases, updatePhrase } from '@/api/phrases'
import { optimizeImage } from '@/features/study-sets/optimizeImage'
import type { Phrase } from '@/types/phrase'

export function phrasesKey() {
  return ['phrases'] as const
}

export function usePhrases() {
  return useQuery({ queryKey: phrasesKey(), queryFn: listPhrases })
}

export interface PhraseFormInput {
  spanish: string
  english: string
  example: string
  image: File | null
  removeImage: boolean
}

export function useCreatePhrase(ownerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ spanish, english, example, image: rawImage }: PhraseFormInput) => {
      const image = rawImage ? await optimizeImage(rawImage) : null
      const id = crypto.randomUUID()
      const imagePath = image ? phraseImagePath(ownerId, id, image.name) : null

      // Upload first, then insert -- a row never references a missing object.
      if (image && imagePath) await uploadCardImage(imagePath, image)
      try {
        return await createPhrase(id, {
          spanish: spanish.trim(),
          english: english.trim(),
          example: example.trim() || null,
          image_path: imagePath,
          idiom_id: null,
        })
      } catch (err) {
        if (imagePath) await deleteCardImages([imagePath]).catch(() => {})
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: phrasesKey() }),
  })
}

export function useUpdatePhrase(ownerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      phrase,
      spanish,
      english,
      example,
      image: rawImage,
      removeImage,
    }: PhraseFormInput & { phrase: Phrase }) => {
      let imagePath = phrase.image_path

      if (rawImage) {
        const image = await optimizeImage(rawImage)
        const newPath = phraseImagePath(ownerId, phrase.id, image.name)
        if (newPath === phrase.image_path) {
          await uploadCardImage(newPath, image, { upsert: true })
        } else {
          await uploadCardImage(newPath, image)
          if (phrase.image_path) await deleteCardImages([phrase.image_path]).catch(() => {})
          imagePath = newPath
        }
      } else if (removeImage && phrase.image_path) {
        await deleteCardImages([phrase.image_path]).catch(() => {})
        imagePath = null
      }

      return updatePhrase(phrase.id, {
        spanish: spanish.trim(),
        english: english.trim(),
        example: example.trim() || null,
        image_path: imagePath,
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: phrasesKey() }),
  })
}

export function useDeletePhrase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (phrase: Phrase) => {
      // Same order as cards: an orphaned row is safer than an orphaned blob.
      if (phrase.image_path) await deleteCardImages([phrase.image_path])
      await deletePhrase(phrase.id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: phrasesKey() }),
  })
}

export function useAddIdiomToPhrases() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addIdiomAsPhrase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: phrasesKey() }),
  })
}
```

`src/features/phrases/hooks/useUserSettings.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getUserSettings, updateNewPhrasesPerDay } from '@/api/userSettings'
import type { UserSettings } from '@/types/phrase'

export function userSettingsKey() {
  return ['user-settings'] as const
}

export function useUserSettings() {
  return useQuery({ queryKey: userSettingsKey(), queryFn: getUserSettings })
}

export function useUpdateNewPhrasesPerDay(ownerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (value: number) => updateNewPhrasesPerDay(ownerId, value),
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: userSettingsKey() })
      const previous = queryClient.getQueryData<UserSettings>(userSettingsKey())
      queryClient.setQueryData<UserSettings>(userSettingsKey(), { new_phrases_per_day: value })
      return previous
    },
    onError: (_err, _value, previous) => {
      queryClient.setQueryData(userSettingsKey(), previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: userSettingsKey() }),
  })
}
```

`src/features/phrases/hooks/useRecordPhraseReview.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PhraseNotFoundError, recordPhraseReview } from '@/api/phraseReviews'
import { phrasesKey } from './usePhrases'

const SAVE_RETRIES = 2

/**
 * Saves one resolved phrase. Retries transient failures twice; a deleted
 * phrase isn't retried. Refetching phrases afterwards is safe mid-session
 * because the session page snapshots its queue at start.
 */
export function useRecordPhraseReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: recordPhraseReview,
    retry: (failureCount, error) =>
      failureCount < SAVE_RETRIES && !(error instanceof PhraseNotFoundError),
    onSettled: () => queryClient.invalidateQueries({ queryKey: phrasesKey() }),
  })
}
```

- [ ] **Step 6: Typecheck, lint, test**

Run: `bun run test && bun run lint && bun run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/api/cardImages.ts src/api/cardImages.test.ts src/api/phrases.ts src/api/userSettings.ts src/api/phraseReviews.ts src/features/phrases/hooks
git commit -m "feat(phrases): add phrase, settings, and review data layer" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `/phrases` page (today panel, calendar, list, form, setting)

**Files:**
- Create: `src/features/phrases/phraseSchema.ts`
- Create: `src/features/phrases/phraseSchema.test.ts`
- Create: `src/features/phrases/TodayPanel.tsx`
- Create: `src/features/phrases/PhraseCalendar.tsx`
- Create: `src/features/phrases/PhraseList.tsx`
- Create: `src/features/phrases/PhraseImageField.tsx`
- Create: `src/features/phrases/PhraseFormDialog.tsx`
- Create: `src/features/phrases/NewPerDaySetting.tsx`
- Create: `src/features/phrases/PhrasesPage.tsx`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Consumes: Task 1 date helpers; Task 3 `dueToday`, `practiceSet`, `forecast`, `FORECAST_DAYS`, `nextBusyDay`, `ForecastDay`; Task 7 hooks and `DEFAULT_NEW_PHRASES_PER_DAY`; `useSignedImageUrls`; `Calendar`/`CalendarDayButton`; `extractDroppedImageFile`/`extractPastedImageFile`; `IMAGE_ACCEPT`
- Produces: `phraseSchema`, `type PhraseFormValues`; components `TodayPanel`, `PhraseCalendar`, `PhraseList`, `PhraseImageField`, `PhraseFormDialog`, `NewPerDaySetting`, `PhrasesPage`; route `/phrases`

- [ ] **Step 1: Write the failing schema test**

`src/features/phrases/phraseSchema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { phraseSchema } from './phraseSchema'

describe('phraseSchema', () => {
  it('requires Spanish and English, trimmed', () => {
    expect(phraseSchema.safeParse({ spanish: '  ', english: 'x', example: '' }).success).toBe(false)
    expect(phraseSchema.safeParse({ spanish: 'x', english: ' ', example: '' }).success).toBe(false)
    expect(phraseSchema.parse({ spanish: ' meter la pata ', english: ' to blunder ', example: '' })).toEqual({
      spanish: 'meter la pata',
      english: 'to blunder',
      example: '',
    })
  })

  it('caps lengths so a typed answer can always be stored', () => {
    expect(phraseSchema.safeParse({ spanish: 'x'.repeat(201), english: 'y', example: '' }).success).toBe(false)
    expect(phraseSchema.safeParse({ spanish: 'x', english: 'y'.repeat(301), example: '' }).success).toBe(false)
    expect(phraseSchema.safeParse({ spanish: 'x', english: 'y', example: 'z'.repeat(501) }).success).toBe(false)
  })
})
```

Run: `bunx vitest run src/features/phrases/phraseSchema.test.ts`
Expected: FAIL. `./phraseSchema` doesn't resolve.

- [ ] **Step 2: Implement the schema**

`src/features/phrases/phraseSchema.ts`:

```ts
import { z } from 'zod'

export const phraseSchema = z.object({
  spanish: z.string().trim().min(1, 'Enter the Spanish phrase').max(200, 'Keep it under 200 characters'),
  english: z.string().trim().min(1, 'Enter the English meaning').max(300, 'Keep it under 300 characters'),
  example: z.string().trim().max(500, 'Keep it under 500 characters'),
})

export type PhraseFormValues = z.infer<typeof phraseSchema>
```

Run: `bunx vitest run src/features/phrases/phraseSchema.test.ts`
Expected: PASS

- [ ] **Step 3: Create `TodayPanel`**

`src/features/phrases/TodayPanel.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { DateKey } from '@/types/phrase'
import { relativeDayLabel } from './dates'
import type { ForecastDay } from './forecast'

export function TodayPanel({
  reviewCount,
  newCount,
  next,
  today,
  canPractice,
}: {
  reviewCount: number
  newCount: number
  next: ForecastDay | null
  today: DateKey
  canPractice: boolean
}) {
  const total = reviewCount + newCount

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {total > 0 ? (
          <>
            <div>
              <p className="text-2xl font-semibold">{total} due today</p>
              {newCount > 0 && <p className="text-muted-foreground text-sm">{newCount} new</p>}
            </div>
            <Button asChild size="lg">
              <Link to="/phrases/review">Start</Link>
            </Button>
          </>
        ) : (
          <>
            <div>
              <p className="text-lg font-semibold">All caught up.</p>
              {next && (
                <p className="text-muted-foreground text-sm">
                  Next {next.reviews + next.newPhrases} due {relativeDayLabel(next.date, today)}.
                </p>
              )}
            </div>
            {canPractice && (
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <Button asChild variant="outline">
                  <Link to="/phrases/practice">Practice anyway</Link>
                </Button>
                <p className="text-muted-foreground text-xs">Practice doesn't change your schedule.</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Create `PhraseCalendar`**

`src/features/phrases/PhraseCalendar.tsx`:

```tsx
import { useMemo, useState, type ComponentProps } from 'react'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { localDateKey } from '@/features/idioms/idiomOfTheDay'
import type { DateKey } from '@/types/phrase'
import { longDate, parseDateKey } from './dates'
import type { ForecastDay } from './forecast'

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** Upcoming due counts per day. A forecast: past days show nothing. */
export function PhraseCalendar({ days, today }: { days: ForecastDay[]; today: DateKey }) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])
  const [selected, setSelected] = useState<DateKey>(today)
  const lastDay = days.at(-1)?.date ?? today

  // Stable per forecast so react-day-picker doesn't remount every day cell
  // on unrelated re-renders.
  const DayButton = useMemo(
    () =>
      function ForecastDayButton(props: ComponentProps<typeof CalendarDayButton>) {
        const day = byDate.get(localDateKey(props.day.date))
        const total = day ? day.reviews + day.newPhrases : 0
        return (
          <CalendarDayButton {...props}>
            {props.children}
            {total > 0 && (
              <span>
                {total}
                <span className="sr-only"> due</span>
              </span>
            )}
          </CalendarDayButton>
        )
      },
    [byDate],
  )

  const selectedDay = byDate.get(selected)

  return (
    <div className="flex flex-col items-center gap-3">
      <Calendar
        mode="single"
        required
        selected={parseDateKey(selected)}
        defaultMonth={parseDateKey(today)}
        startMonth={parseDateKey(today)}
        endMonth={parseDateKey(lastDay)}
        disabled={{ before: parseDateKey(today), after: parseDateKey(lastDay) }}
        onSelect={(date) => setSelected(localDateKey(date))}
        components={{ DayButton }}
        className="[--cell-size:--spacing(10)]"
      />
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {longDate(selected)} —{' '}
        {selectedDay && selectedDay.reviews + selectedDay.newPhrases > 0
          ? `${plural(selectedDay.reviews, 'review')}, ${selectedDay.newPhrases} new`
          : 'nothing due'}
      </p>
    </div>
  )
}
```

- [ ] **Step 5: Create `PhraseList`**

`src/features/phrases/PhraseList.tsx`:

```tsx
import type { DateKey, Phrase } from '@/types/phrase'
import { shortDate } from './dates'

function dueTag(phrase: Phrase, today: DateKey): string {
  if (phrase.due_on === null) return 'new'
  if (phrase.due_on <= today) return 'due'
  return `next: ${shortDate(phrase.due_on)}`
}

export function PhraseList({
  phrases,
  imageUrls,
  today,
  onEdit,
}: {
  phrases: Phrase[]
  imageUrls: Record<string, string>
  today: DateKey
  onEdit: (phrase: Phrase) => void
}) {
  if (phrases.length === 0) {
    return (
      <p className="text-muted-foreground">
        No phrases yet. Add your own, or add the idiom of the day from the dashboard.
      </p>
    )
  }

  return (
    <ul className="divide-y rounded-lg border">
      {phrases.map((phrase) => {
        const imageUrl = phrase.image_path ? imageUrls[phrase.image_path] : undefined
        return (
          <li key={phrase.id}>
            <button
              type="button"
              onClick={() => onEdit(phrase)}
              className="hover:bg-muted/50 flex w-full items-center gap-3 p-3 text-left"
            >
              {imageUrl ? (
                <img src={imageUrl} alt="" className="size-10 shrink-0 rounded object-cover" />
              ) : (
                <div className="bg-muted size-10 shrink-0 rounded" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p lang="es" className="truncate font-medium">
                  {phrase.spanish}
                </p>
                <p className="text-muted-foreground truncate text-sm">{phrase.english}</p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs">{dueTag(phrase, today)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 6: Create `PhraseImageField`**

`src/features/phrases/PhraseImageField.tsx`:

```tsx
import { ImagePlus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { IMAGE_ACCEPT } from '@/features/study-sets/imageFormats'
import { extractDroppedImageFile } from '@/features/study-sets/imageDrop'
import { cn } from '@/lib/utils'

/** Optional image: click to pick, drop a file/web image, or paste (handled by the form). */
export function PhraseImageField({
  previewUrl,
  onPick,
  onRemove,
}: {
  previewUrl: string | null
  onPick: (file: File) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (e) => {
        e.preventDefault()
        setDragging(false)
        const file = await extractDroppedImageFile(e)
        if (file) onPick(file)
      }}
      className={cn(
        'bg-muted/30 relative flex min-h-32 items-center justify-center overflow-hidden rounded-lg border border-dashed',
        dragging && 'border-primary bg-primary/5',
      )}
    >
      {previewUrl ? (
        <>
          <img src={previewUrl} alt="" className="max-h-48 w-full object-contain" />
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            aria-label="Remove image"
            className="absolute top-2 right-2"
            onClick={onRemove}
          >
            <X />
          </Button>
        </>
      ) : (
        <Button type="button" variant="ghost" onClick={() => inputRef.current?.click()}>
          <ImagePlus data-icon="inline-start" />
          Add an image (optional)
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPick(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
```

- [ ] **Step 7: Create `PhraseFormDialog`**

`src/features/phrases/PhraseFormDialog.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { extractPastedImageFile } from '@/features/study-sets/imageDrop'
import { PhraseImageField } from './PhraseImageField'
import { phraseSchema, type PhraseFormValues } from './phraseSchema'

export interface PhraseFormSubmit extends PhraseFormValues {
  image: File | null
  removeImage: boolean
}

/**
 * Add/edit a phrase. Mount fresh per phrase (parent keys it) so the form
 * starts from `initial`. Pass `onDelete` to show the delete action.
 */
export function PhraseFormDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  initial,
  initialImageUrl,
  onSubmit,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel: string
  initial: PhraseFormValues
  initialImageUrl: string | null
  onSubmit: (values: PhraseFormSubmit) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PhraseFormValues>({ resolver: zodResolver(phraseSchema), defaultValues: initial })

  const [image, setImage] = useState<File | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [pickedUrl, setPickedUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!image) return
    const url = URL.createObjectURL(image)
    setPickedUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  const previewUrl = image ? pickedUrl : removeImage ? null : initialImageUrl

  function pick(file: File) {
    setImage(file)
    setRemoveImage(false)
  }

  async function submit(values: PhraseFormValues) {
    setError(null)
    try {
      await onSubmit({ ...values, image, removeImage })
    } catch {
      setError("Couldn't save the phrase. Please try again.")
    }
  }

  async function confirmDelete() {
    if (!onDelete) return
    setDeleting(true)
    setError(null)
    try {
      await onDelete()
    } catch {
      setError("Couldn't delete the phrase. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPaste={(e) => {
          const file = extractPastedImageFile(e)
          if (file) pick(file)
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phrase-spanish">Spanish</Label>
            <Input id="phrase-spanish" lang="es" autoComplete="off" {...register('spanish')} />
            {errors.spanish && <p className="text-destructive text-sm">{errors.spanish.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phrase-english">English meaning</Label>
            <Input id="phrase-english" autoComplete="off" {...register('english')} />
            {errors.english && <p className="text-destructive text-sm">{errors.english.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phrase-example">Example (optional)</Label>
            <Textarea id="phrase-example" lang="es" rows={2} {...register('example')} />
            {errors.example && <p className="text-destructive text-sm">{errors.example.message}</p>}
          </div>
          <PhraseImageField
            previewUrl={previewUrl}
            onPick={pick}
            onRemove={() => {
              setImage(null)
              setRemoveImage(true)
            }}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter className="sm:justify-between">
            {onDelete ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="text-destructive" disabled={deleting}>
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this phrase?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Its review history and schedule are deleted too. This can't be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={isSubmitting || deleting}>
              {isSubmitting && <Loader2 data-icon="inline-start" className="animate-spin" />}
              {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 8: Create `NewPerDaySetting`**

`src/features/phrases/NewPerDaySetting.tsx`:

```tsx
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const MIN = 0
const MAX = 100

/** Commits on blur or Enter; an invalid entry snaps back to the saved value. */
export function NewPerDaySetting({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [syncedValue, setSyncedValue] = useState(value)
  if (value !== syncedValue) {
    setSyncedValue(value)
    setDraft(String(value))
  }

  function commit() {
    const parsed = Number(draft)
    if (draft.trim() === '' || !Number.isInteger(parsed) || parsed < MIN || parsed > MAX) {
      setDraft(String(value))
      return
    }
    if (parsed !== value) onChange(parsed)
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="new-per-day" className="text-muted-foreground font-normal">
        New phrases per day
      </Label>
      <Input
        id="new-per-day"
        type="number"
        inputMode="numeric"
        min={MIN}
        max={MAX}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
        }}
        className="w-20"
      />
    </div>
  )
}
```

- [ ] **Step 9: Create the `PhrasesPage` container**

`src/features/phrases/PhrasesPage.tsx`:

```tsx
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DEFAULT_NEW_PHRASES_PER_DAY } from '@/api/userSettings'
import { useAuth } from '@/features/auth/AuthContext'
import { useSignedImageUrls } from '@/features/study-sets/hooks/useSignedImageUrls'
import type { Phrase } from '@/types/phrase'
import { dueToday, practiceSet } from './dailyQueue'
import { todayKey } from './dates'
import { forecast, FORECAST_DAYS, nextBusyDay } from './forecast'
import { NewPerDaySetting } from './NewPerDaySetting'
import { PhraseCalendar } from './PhraseCalendar'
import { PhraseFormDialog } from './PhraseFormDialog'
import { PhraseList } from './PhraseList'
import { TodayPanel } from './TodayPanel'
import { useCreatePhrase, useDeletePhrase, usePhrases, useUpdatePhrase } from './hooks/usePhrases'
import { useUpdateNewPhrasesPerDay, useUserSettings } from './hooks/useUserSettings'

const EMPTY_FORM = { spanish: '', english: '', example: '' }

export function PhrasesPage() {
  const { user } = useAuth()
  const ownerId = user!.id
  const today = todayKey()

  const { data: phrases, isLoading, isError } = usePhrases()
  const { data: settings } = useUserSettings()
  const cap = settings?.new_phrases_per_day ?? DEFAULT_NEW_PHRASES_PER_DAY

  const createPhrase = useCreatePhrase(ownerId)
  const updatePhrase = useUpdatePhrase(ownerId)
  const deletePhrase = useDeletePhrase()
  const updateCap = useUpdateNewPhrasesPerDay(ownerId)

  const queue = useMemo(() => (phrases ? dueToday(phrases, today, cap) : null), [phrases, today, cap])
  const days = useMemo(
    () => (phrases ? forecast(phrases, today, cap, FORECAST_DAYS) : []),
    [phrases, today, cap],
  )
  const canPractice = useMemo(
    () => (phrases ? practiceSet(phrases, today).length > 0 : false),
    [phrases, today],
  )
  const newestFirst = useMemo(() => [...(phrases ?? [])].reverse(), [phrases])

  const imagePaths = useMemo(
    () => (phrases ?? []).flatMap((p) => (p.image_path ? [p.image_path] : [])),
    [phrases],
  )
  const { data: imageUrls } = useSignedImageUrls(imagePaths)

  const [editing, setEditing] = useState<Phrase | 'new' | null>(null)
  const editingPhrase = editing !== 'new' ? editing : null

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <Link to="/" className="text-muted-foreground text-sm underline underline-offset-4">
        ← Back to dashboard
      </Link>
      <h1 className="text-xl font-semibold">Phrases</h1>

      {isLoading && <div className="bg-muted h-24 animate-pulse rounded-xl" />}
      {isError && (
        <p className="text-destructive text-sm">Couldn't load your phrases. Refresh to try again.</p>
      )}

      {queue && (
        <TodayPanel
          reviewCount={queue.reviews.length}
          newCount={queue.fresh.length}
          next={nextBusyDay(days, today)}
          today={today}
          canPractice={canPractice}
        />
      )}

      {phrases && (
        <Card>
          <CardContent>
            <PhraseCalendar days={days} today={today} />
          </CardContent>
        </Card>
      )}

      {phrases && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Your phrases ({phrases.length})</h2>
            <div className="flex items-center gap-3">
              <NewPerDaySetting value={cap} onChange={(value) => updateCap.mutate(value)} />
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus data-icon="inline-start" />
                Add phrase
              </Button>
            </div>
          </div>
          <PhraseList
            phrases={newestFirst}
            imageUrls={imageUrls}
            today={today}
            onEdit={(phrase) => setEditing(phrase)}
          />
        </section>
      )}

      {editing && (
        <PhraseFormDialog
          key={editingPhrase?.id ?? 'new'}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          title={editingPhrase ? 'Edit phrase' : 'Add phrase'}
          submitLabel={editingPhrase ? 'Save' : 'Add'}
          initial={
            editingPhrase
              ? {
                  spanish: editingPhrase.spanish,
                  english: editingPhrase.english,
                  example: editingPhrase.example ?? '',
                }
              : EMPTY_FORM
          }
          initialImageUrl={
            editingPhrase?.image_path ? (imageUrls[editingPhrase.image_path] ?? null) : null
          }
          onSubmit={async (values) => {
            if (editingPhrase) await updatePhrase.mutateAsync({ phrase: editingPhrase, ...values })
            else await createPhrase.mutateAsync(values)
            setEditing(null)
          }}
          onDelete={
            editingPhrase
              ? async () => {
                  await deletePhrase.mutateAsync(editingPhrase)
                  setEditing(null)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
```

- [ ] **Step 10: Add the route**

In `src/app/router.tsx`, add the import and the route inside the `<Route element={<Layout />}>` block:

```tsx
import { PhrasesPage } from '@/features/phrases/PhrasesPage'
```

```tsx
            <Route path="/phrases" element={<PhrasesPage />} />
```

- [ ] **Step 11: Verify**

Run: `bun run test && bun run lint && bun run build`
Expected: all pass.

With the local stack running (`bun run db:start`, `.env.local` pointed at it), run `bun run dev` and open `#/phrases`. Check the following:
- An empty collection shows the empty-state text.
- Adding three phrases (one with a pasted image) makes the Today panel say "3 due today (3 new)".
- Setting new per day to 2 changes it to "2 due today (2 new)", and tomorrow's calendar cell shows 1.
- Editing a phrase saves; replacing and removing its image both work.
- Deleting asks for confirmation first.
- The calendar's selected-day line reads e.g. "Wed, Oct 14 — 0 reviews, 1 new".

- [ ] **Step 12: Commit**

```bash
git add src/features/phrases/phraseSchema.ts src/features/phrases/phraseSchema.test.ts src/features/phrases/TodayPanel.tsx src/features/phrases/PhraseCalendar.tsx src/features/phrases/PhraseList.tsx src/features/phrases/PhraseImageField.tsx src/features/phrases/PhraseFormDialog.tsx src/features/phrases/NewPerDaySetting.tsx src/features/phrases/PhrasesPage.tsx src/app/router.tsx
git commit -m "feat(phrases): add phrases page with today panel, due calendar, and phrase editing" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Review and practice sessions

**Files:**
- Create: `src/features/phrases/sessionQueue.ts`
- Create: `src/features/phrases/sessionQueue.test.ts`
- Create: `src/features/phrases/PhraseQuizCard.tsx`
- Create: `src/features/phrases/PhraseSessionPage.tsx`
- Modify: `src/app/router.tsx`

**Interfaces:**
- Consumes: Task 1 `todayKey`, `relativeDayLabel`, `nextSchedule`; Task 2 `gradePhrase`, `ratingFor`, `feedbackNote`, `PhraseGrade`; Task 3 `dueToday`, `practiceSet`; Task 5 `callGradePhrase`, `warmUpGrader`; Task 6 `TypedAnswerQuiz`, `GradeOutcome`, `Resolution`; Task 7 `usePhrases`, `useUserSettings`, `useRecordPhraseReview`, `PhraseNotFoundError`, `DEFAULT_NEW_PHRASES_PER_DAY`
- Produces:
  - `type SessionMode = 'review' | 'practice'`
  - `interface SessionItem { phrase: Phrase; isRepeat: boolean }`
  - `buildSession(phrases: Phrase[]): SessionItem[]`
  - `afterResolved(queue: SessionItem[], index: number, rating: PhraseRating, mode: SessionMode): SessionItem[]`
  - `interface SessionResult { rating: PhraseRating; nextDue: DateKey | null }`
  - `summarize(results: SessionResult[]): { firstTry: number; neededMore: number; nextDue: DateKey | null }`
  - `interface PhraseOutcome extends GradeOutcome { grade: PhraseGrade }`
  - `<PhraseQuizCard phrase imageUrl onResolved onNext />`, `<PhraseSessionPage mode />`
  - routes `/phrases/review`, `/phrases/practice`

- [ ] **Step 1: Write the failing session-queue tests**

`src/features/phrases/sessionQueue.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { afterResolved, buildSession, summarize } from './sessionQueue'
import { makePhrase } from './testPhrase'

const a = makePhrase()
const b = makePhrase()

describe('buildSession', () => {
  it('makes one first-pass item per phrase, in order', () => {
    expect(buildSession([a, b])).toEqual([
      { phrase: a, isRepeat: false },
      { phrase: b, isRepeat: false },
    ])
  })
})

describe('afterResolved', () => {
  it('re-queues a missed phrase once at the end of a review session', () => {
    const queue = buildSession([a, b])
    expect(afterResolved(queue, 0, 'again', 'review')).toEqual([
      { phrase: a, isRepeat: false },
      { phrase: b, isRepeat: false },
      { phrase: a, isRepeat: true },
    ])
  })

  it('does not re-queue a repeat that is missed again', () => {
    const queue = [...buildSession([a]), { phrase: a, isRepeat: true }]
    expect(afterResolved(queue, 1, 'again', 'review')).toBe(queue)
  })

  it('does not re-queue hard or good answers', () => {
    const queue = buildSession([a])
    expect(afterResolved(queue, 0, 'hard', 'review')).toBe(queue)
    expect(afterResolved(queue, 0, 'good', 'review')).toBe(queue)
  })

  it('does not re-queue in practice sessions', () => {
    const queue = buildSession([a])
    expect(afterResolved(queue, 0, 'again', 'practice')).toBe(queue)
  })
})

describe('summarize', () => {
  it('counts first-try successes, the rest, and the soonest next due date', () => {
    expect(
      summarize([
        { rating: 'good', nextDue: '2026-10-16' },
        { rating: 'hard', nextDue: '2026-10-14' },
        { rating: 'again', nextDue: '2026-10-14' },
        { rating: 'good', nextDue: '2026-10-20' },
      ]),
    ).toEqual({ firstTry: 2, neededMore: 2, nextDue: '2026-10-14' })
  })

  it('has no next due date for practice results', () => {
    expect(summarize([{ rating: 'good', nextDue: null }])).toEqual({
      firstTry: 1,
      neededMore: 0,
      nextDue: null,
    })
  })
})
```

Run: `bunx vitest run src/features/phrases/sessionQueue.test.ts`
Expected: FAIL. `./sessionQueue` doesn't resolve.

- [ ] **Step 2: Implement `sessionQueue.ts`**

`src/features/phrases/sessionQueue.ts`:

```ts
import type { DateKey, Phrase, PhraseRating } from '@/types/phrase'

export type SessionMode = 'review' | 'practice'

export interface SessionItem {
  phrase: Phrase
  /** End-of-session repeat of a missed phrase: shown, never saved. */
  isRepeat: boolean
}

export interface SessionResult {
  rating: PhraseRating
  /** The new due date for a scheduled review; null for practice. */
  nextDue: DateKey | null
}

export function buildSession(phrases: Phrase[]): SessionItem[] {
  return phrases.map((phrase) => ({ phrase, isRepeat: false }))
}

/**
 * In a review session, a phrase missed on its first pass comes back once at
 * the end so the learner leaves having typed it correctly. Repeats never
 * re-queue, so the session always ends.
 */
export function afterResolved(
  queue: SessionItem[],
  index: number,
  rating: PhraseRating,
  mode: SessionMode,
): SessionItem[] {
  const item = queue[index]
  if (mode !== 'review' || rating !== 'again' || item.isRepeat) return queue
  return [...queue, { phrase: item.phrase, isRepeat: true }]
}

export function summarize(results: SessionResult[]): {
  firstTry: number
  neededMore: number
  nextDue: DateKey | null
} {
  const firstTry = results.filter((r) => r.rating === 'good').length
  const dueDates = results.flatMap((r) => (r.nextDue ? [r.nextDue] : [])).sort()
  return { firstTry, neededMore: results.length - firstTry, nextDue: dueDates[0] ?? null }
}
```

Run: `bunx vitest run src/features/phrases/sessionQueue.test.ts`
Expected: PASS

- [ ] **Step 3: Create `PhraseQuizCard`**

`src/features/phrases/PhraseQuizCard.tsx`:

```tsx
import { callGradePhrase } from '@/api/gradePhrase'
import { TypedAnswerQuiz } from '@/components/TypedAnswerQuiz'
import type { GradeOutcome, Resolution } from '@/components/typedAnswerState'
import type { Phrase } from '@/types/phrase'
import { feedbackNote, gradePhrase, type PhraseGrade } from './grading'

export interface PhraseOutcome extends GradeOutcome {
  grade: PhraseGrade
}

/**
 * One phrase question: English (+ optional image) prompt, typed Spanish
 * answer graded by exact match then Jev. Saving is the parent's job. Mount
 * fresh per item (parent keys it).
 */
export function PhraseQuizCard({
  phrase,
  imageUrl,
  onResolved,
  onNext,
}: {
  phrase: Phrase
  imageUrl: string | undefined
  onResolved: (resolution: Resolution<PhraseOutcome>) => void
  onNext: () => void
}) {
  const prompt = (
    <>
      {phrase.image_path && (
        <div className="bg-muted/30 flex min-h-48 items-center justify-center overflow-hidden rounded-lg border">
          {imageUrl ? (
            <img src={imageUrl} alt="" decoding="async" className="max-h-72 w-full object-contain" />
          ) : (
            <p className="text-muted-foreground p-8 text-sm">Loading image…</p>
          )}
        </div>
      )}
      <div className="bg-muted/30 flex min-h-32 items-center justify-center rounded-lg border p-6">
        <p className="text-center text-xl font-medium">{phrase.english}</p>
      </div>
    </>
  )

  return (
    <TypedAnswerQuiz<PhraseOutcome>
      prompt={prompt}
      expectedAnswer={phrase.spanish}
      showAccentPad
      grade={async (typed) => {
        const grade = await gradePhrase(typed, phrase, callGradePhrase)
        return { correct: grade.correct, note: feedbackNote(grade, phrase.spanish), grade }
      }}
      onResolved={onResolved}
      onNext={onNext}
    />
  )
}
```

- [ ] **Step 4: Create the `PhraseSessionPage` container**

`src/features/phrases/PhraseSessionPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { warmUpGrader } from '@/api/gradePhrase'
import { PhraseNotFoundError } from '@/api/phraseReviews'
import { DEFAULT_NEW_PHRASES_PER_DAY } from '@/api/userSettings'
import type { Resolution } from '@/components/typedAnswerState'
import { Button } from '@/components/ui/button'
import { useSignedImageUrls } from '@/features/study-sets/hooks/useSignedImageUrls'
import { useImagePrefetch } from '@/hooks/useImagePrefetch'
import { dueToday, practiceSet } from './dailyQueue'
import { relativeDayLabel, todayKey } from './dates'
import { ratingFor } from './grading'
import { PhraseQuizCard, type PhraseOutcome } from './PhraseQuizCard'
import { nextSchedule } from './scheduler'
import {
  afterResolved,
  buildSession,
  summarize,
  type SessionItem,
  type SessionMode,
  type SessionResult,
} from './sessionQueue'
import { usePhrases } from './hooks/usePhrases'
import { useRecordPhraseReview } from './hooks/useRecordPhraseReview'
import { useUserSettings } from './hooks/useUserSettings'

export function PhraseSessionPage({ mode }: { mode: SessionMode }) {
  // Pinned at start: a session that runs past midnight keeps its date.
  const [today] = useState(() => todayKey())
  const { data: phrases, isLoading, isError } = usePhrases()
  const { data: settings } = useUserSettings()
  const record = useRecordPhraseReview()

  const [queue, setQueue] = useState<SessionItem[] | null>(null)
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<SessionResult[]>([])
  const [saveFailed, setSaveFailed] = useState(false)

  // Snapshot the queue once. Each save refetches phrases; rebuilding from
  // that would drop phrases just reviewed and shift the current index.
  useEffect(() => {
    if (queue || !phrases || !settings) return
    const cap = settings.new_phrases_per_day ?? DEFAULT_NEW_PHRASES_PER_DAY
    if (mode === 'review') {
      const { reviews, fresh } = dueToday(phrases, today, cap)
      setQueue(buildSession([...reviews, ...fresh]))
    } else {
      setQueue(buildSession(practiceSet(phrases, today)))
    }
  }, [queue, phrases, settings, mode, today])

  useEffect(() => {
    warmUpGrader()
  }, [])

  const imagePaths = useMemo(
    () => (queue ?? []).flatMap((item) => (item.phrase.image_path ? [item.phrase.image_path] : [])),
    [queue],
  )
  const { data: imageUrls } = useSignedImageUrls(imagePaths)
  useImagePrefetch(useMemo(() => Object.values(imageUrls), [imageUrls]))

  const current = queue?.[index]
  const isComplete = !!queue && queue.length > 0 && index >= queue.length
  const firstPassCount = queue?.filter((item) => !item.isRepeat).length ?? 0

  function handleResolved(item: SessionItem, resolution: Resolution<PhraseOutcome>) {
    const { grade } = resolution.outcome
    const rating = ratingFor({
      correct: resolution.correct,
      attemptCount: resolution.attemptCount,
      verdict: grade.verdict,
    })

    if (!item.isRepeat) {
      const schedule = mode === 'review' ? nextSchedule(item.phrase, rating, today) : null
      // mutateAsync, not mutate's per-call onError: React Query only fires
      // per-call callbacks for the latest mutate, and saves overlap here.
      record
        .mutateAsync({
          phraseId: item.phrase.id,
          reviewedOn: today,
          rating,
          attemptCount: resolution.attemptCount,
          typedAnswer: resolution.typed,
          gradeSource: grade.source,
          jevVerdict: grade.jevVerdict,
          isPractice: mode === 'practice',
          schedule,
        })
        .catch((error) => {
          // A phrase deleted mid-session has nothing to save; skip quietly.
          if (!(error instanceof PhraseNotFoundError)) setSaveFailed(true)
        })
      setResults((r) => [...r, { rating, nextDue: schedule?.due_on ?? null }])
    }

    setQueue((q) => (q ? afterResolved(q, index, rating, mode) : q))
  }

  const summary = summarize(results)

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-4">
      <Link to="/phrases" className="text-muted-foreground text-sm underline underline-offset-4">
        ← Back to phrases
      </Link>

      {mode === 'practice' && (
        <p className="text-muted-foreground text-sm">Practice session. Your schedule won't change.</p>
      )}

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn't load your phrases.</p>}

      {saveFailed && (
        <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm">
          Couldn't save a result. That phrase will stay due.
        </p>
      )}

      {queue && queue.length === 0 && (
        <p className="text-muted-foreground">
          Nothing to {mode === 'review' ? 'review' : 'practice'} right now.{' '}
          <Link to="/phrases" className="underline underline-offset-4">
            Back to phrases
          </Link>
        </p>
      )}

      {current && (
        <>
          <p className="text-muted-foreground text-sm">
            {current.isRepeat
              ? 'One more try at the ones you missed'
              : `Phrase ${Math.min(index + 1, firstPassCount)} of ${firstPassCount}`}
          </p>
          <PhraseQuizCard
            key={`${current.phrase.id}:${current.isRepeat}`}
            phrase={current.phrase}
            imageUrl={current.phrase.image_path ? imageUrls[current.phrase.image_path] : undefined}
            onResolved={(resolution) => handleResolved(current, resolution)}
            onNext={() => setIndex((i) => i + 1)}
          />
        </>
      )}

      {isComplete && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <h1 className="text-xl font-semibold">
            {mode === 'review' ? 'Done for today!' : 'Practice done!'}
          </h1>
          <p className="text-muted-foreground">
            {summary.firstTry} right on the first try, {summary.neededMore} needed more.
          </p>
          {summary.nextDue && (
            <p className="text-muted-foreground text-sm">
              Next up {relativeDayLabel(summary.nextDue, today)}.
            </p>
          )}
          <Button asChild>
            <Link to="/phrases">Back to phrases</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Add the routes**

In `src/app/router.tsx`, add the import and these routes next to `/phrases`. The `key`s stop React from reusing one session's state for the other mode.

```tsx
import { PhraseSessionPage } from '@/features/phrases/PhraseSessionPage'
```

```tsx
            <Route path="/phrases/review" element={<PhraseSessionPage key="review" mode="review" />} />
            <Route
              path="/phrases/practice"
              element={<PhraseSessionPage key="practice" mode="practice" />}
            />
```

- [ ] **Step 6: Verify**

Run: `bun run test && bun run lint && bun run build`
Expected: all pass.

Manual check against the local stack, with `supabase functions serve` running per Task 5:
- Start today's session. Type one phrase exactly, misspell an accent on another, and miss a third three times.
- Expect, in order: "Correct!"; "Accepted. Exact form: …"; and the reveal.
- The missed phrase comes back once at the end as "One more try…", and missing it again doesn't bring it back a third time.
- The summary reads "1 right on the first try, 2 needed more".
- Back on `/phrases`, the Today panel shows "All caught up" and the calendar shows those phrases on their new dates.
- Practice anyway: answer a phrase. Its "next:" date in the list doesn't change.
- Stop `functions serve`, then answer a non-exact phrase in practice. It's graded wrong within about 4 s instead of hanging.

- [ ] **Step 7: Commit**

```bash
git add src/features/phrases/sessionQueue.ts src/features/phrases/sessionQueue.test.ts src/features/phrases/PhraseQuizCard.tsx src/features/phrases/PhraseSessionPage.tsx src/app/router.tsx
git commit -m "feat(phrases): add daily review and practice-ahead sessions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Dashboard tile and "Add to my phrases" on Idiom of the Day

**Files:**
- Create: `src/features/phrases/PhrasesTile.tsx`
- Modify: `src/features/study-sets/DashboardPage.tsx`
- Modify: `src/features/idioms/IdiomOfTheDayCard.tsx`
- Modify: `src/features/idioms/IdiomOfTheDayBanner.tsx`

**Interfaces:**
- Consumes: Task 3 `dueToday`; Task 1 `todayKey`; Task 7 `usePhrases`, `useUserSettings`, `useAddIdiomToPhrases`, `DEFAULT_NEW_PHRASES_PER_DAY`
- Produces: `<PhrasesTile dueCount={number | null} />`; `IdiomOfTheDayCard` gains props `phraseStatus: 'add' | 'adding' | 'added' | null` and `onAddToPhrases: () => void`

- [ ] **Step 1: Create the tile**

`src/features/phrases/PhrasesTile.tsx`:

```tsx
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardTitle } from '@/components/ui/card'

/** Dashboard entry to /phrases. `dueCount` is null while loading. */
export function PhrasesTile({ dueCount }: { dueCount: number | null }) {
  return (
    <Link
      to="/phrases"
      className="group/row ease-out-strong after:ease-out-strong relative isolate block rounded-xl transition-transform duration-200 after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-xl after:opacity-0 after:shadow-lg after:transition-opacity after:duration-200 hover:-translate-y-0.5 hover:after:opacity-100 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <Card>
        <CardContent className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle>Phrases</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              {dueCount === null
                ? 'Loading…'
                : dueCount === 0
                  ? 'All caught up today'
                  : `${dueCount} due today`}
            </p>
          </div>
          <ChevronRight aria-hidden className="text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Render it on the dashboard**

In `src/features/study-sets/DashboardPage.tsx`, add these imports:

```tsx
import { useMemo } from 'react'
import { DEFAULT_NEW_PHRASES_PER_DAY } from '@/api/userSettings'
import { dueToday } from '@/features/phrases/dailyQueue'
import { todayKey } from '@/features/phrases/dates'
import { usePhrases } from '@/features/phrases/hooks/usePhrases'
import { useUserSettings } from '@/features/phrases/hooks/useUserSettings'
import { PhrasesTile } from '@/features/phrases/PhrasesTile'
```

At the top of `DashboardPage()`, after the `useStudySets()` line, add:

```tsx
  const { data: phrases } = usePhrases()
  const { data: settings } = useUserSettings()
  const phrasesDue = useMemo(() => {
    if (!phrases) return null
    const { reviews, fresh } = dueToday(
      phrases,
      todayKey(),
      settings?.new_phrases_per_day ?? DEFAULT_NEW_PHRASES_PER_DAY,
    )
    return reviews.length + fresh.length
  }, [phrases, settings])
```

Directly after `<IdiomOfTheDayBanner />`, add:

```tsx
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <PhrasesTile dueCount={phrasesDue} />
      </div>
```

- [ ] **Step 3: Add the button to the idiom card**

In `src/features/idioms/IdiomOfTheDayCard.tsx`:

1. Change the lucide import to `import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react'`.
2. Add these two props to the destructured props and their type:

```tsx
  phraseStatus,
  onAddToPhrases,
```

```tsx
  /** null hides the control (e.g. phrases still loading). */
  phraseStatus: 'add' | 'adding' | 'added' | null
  onAddToPhrases: () => void
```

3. Inside the middle column `<div className="col-span-2 flex flex-col gap-1 ...">`, directly after the `{idiom.example && (...)}` block and before `<Source idiom={idiom} className="lg:hidden" />`, insert:

```tsx
            {phraseStatus === 'added' && (
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                <Check className="size-4" aria-hidden />
                In your phrases
              </p>
            )}
            {(phraseStatus === 'add' || phraseStatus === 'adding') && (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                disabled={phraseStatus === 'adding'}
                onClick={onAddToPhrases}
              >
                <Plus data-icon="inline-start" />
                Add to my phrases
              </Button>
            )}
```

- [ ] **Step 4: Wire it in the banner**

In `src/features/idioms/IdiomOfTheDayBanner.tsx`, add these imports:

```tsx
import { useAddIdiomToPhrases, usePhrases } from '@/features/phrases/hooks/usePhrases'
```

In `IdiomOfTheDayBanner()`, after the `useIdiomOfTheDay` line, add:

```tsx
  const { data: phrases } = usePhrases()
  const addToPhrases = useAddIdiomToPhrases()
```

Replace the final `return (<IdiomOfTheDayCard ... />)` with:

```tsx
  const phraseStatus = !phrases
    ? null
    : phrases.some((p) => p.idiom_id === idiom.id)
      ? 'added'
      : addToPhrases.isPending && addToPhrases.variables?.id === idiom.id
        ? 'adding'
        : 'add'

  return (
    <IdiomOfTheDayCard
      idiom={idiom}
      dateLabel={dayLabel(today, daysAgo)}
      selectedDate={selectedDate}
      minDate={subtractDays(today, MAX_DAYS_BACK)}
      maxDate={subtractDays(today, 0)}
      onSelectDate={(date) => setDaysAgo(daysBetween(today, date))}
      onPrevious={() => setDaysAgo((d) => Math.min(d + 1, MAX_DAYS_BACK))}
      onNext={() => setDaysAgo((d) => Math.max(d - 1, 0))}
      phraseStatus={phraseStatus}
      onAddToPhrases={() => addToPhrases.mutate(idiom)}
    />
  )
```

- [ ] **Step 5: Verify**

Run: `bun run test && bun run lint && bun run build`
Expected: all pass.

In the local app's dashboard:
- The Phrases tile shows the due count and links to `/phrases`.
- Clicking "Add to my phrases" on the idiom turns it into "In your phrases ✓", and the idiom appears on `/phrases` as new.
- Browsing back to a previous day's idiom shows its own add state.
- At `lg` width, the button doesn't break the fixed-height idiom card. If it overflows, the middle column scrolls (`lg:overflow-y-auto`), which is acceptable.

- [ ] **Step 6: Commit**

```bash
git add src/features/phrases/PhrasesTile.tsx src/features/study-sets/DashboardPage.tsx src/features/idioms/IdiomOfTheDayCard.tsx src/features/idioms/IdiomOfTheDayBanner.tsx
git commit -m "feat(phrases): add dashboard phrases tile and add-idiom-to-phrases action" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Full verification

**Files:** none new. Fix anything this turns up in the task that owns it.

- [ ] **Step 1: Run the whole suite**

Run: `bun run format:check && bun run lint && bun run test && bun run build && deno test supabase/functions/grade-phrase/`
Expected: all pass. If `format:check` fails, run `bun run format` and commit the formatting separately.

- [ ] **Step 2: Fresh database**

Run: `bun run db:reset`, then re-run the Task 4 Step 3 verification script.
Expected: `ROLLBACK`, no errors.

- [ ] **Step 3: End-to-end walkthrough (local stack + `supabase functions serve`)**

Sign up as two users in two browser profiles. As user A:

1. Add the idiom of the day plus 3 typed phrases, one with an image. Set new per day to 2.
2. `/phrases` shows "2 due today (2 new)", and the calendar shows 2 tomorrow.
3. Do the review: one first-try exact, one revealed. The missed one repeats once. The summary is correct.
4. The Today panel reads "All caught up. Next … due tomorrow." **Practice anyway** works, and the phrase dates in the list don't change afterwards.
5. Reload `/phrases/review` mid-session after answering one phrase. The answered phrase is gone from the new queue, and its schedule saved exactly once (check `phrase_reviews` in Studio at http://127.0.0.1:54323).

As user B: `/phrases` is empty and the dashboard tile says "All caught up today".

Then sign back in as A and open a study set session. The quiz behaves exactly as before Task 6.

- [ ] **Step 4: Note deployment prerequisites for the PR**

The PR description must list the one-time setup from the README's Edge Functions section:
- GitHub secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF`
- `TYPESAFE_API_KEY` as a Supabase function secret

Until the secret is set, grading falls back to strict exact match, so the feature works but is unforgiving. The migration needs no manual step; it's applied by the integration on merge.
