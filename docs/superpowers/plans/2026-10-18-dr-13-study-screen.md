# DR-13 Study Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A learner can pick a set's study mode on the phone, tap **Study**, and go through the quiz:

- 3 attempts per card
- an accented-character pad
- haptics
- a completion summary

The session and every attempt are saved to Supabase.

**Architecture:**

- **Quiz logic** comes from `@escritorio/core` (`studyMode.ts`, `grading.ts`), so mobile grades exactly like web.
- **Screens:** `QuizCard` handles one card (attempts, feedback, accent pad); `StudyScreen` handles one run (deck built once, session lifecycle, summary).
- **Saving:** all writes go through a `StudyWriter` that sends them one at a time, in order, with client-generated ids. DR-14 swaps its in-memory queue for the persisted outbox without touching the screens.
- **Mode picker:** it works like web. The choice is kept on the device, per set (AsyncStorage on the phone, `localStorage` on web), and falls back to the set's own fields. It is never written to Supabase. The key format and the check that rejects bad stored values come from core, so both apps read the same data the same way.

**Tech Stack:** Expo SDK 58, Expo Router 58, NativeWind 4, TanStack Query 5, `expo-haptics`, `expo-crypto`, `expo-image`, `jest-expo` + React Native Testing Library 14 (async `render`/`fireEvent`).

**Spec:** `docs/superpowers/specs/2026-10-13-ios-app-design.md`. Relevant sections:

- Mobile app → Screens (`/sets/[id]`, `/sets/[id]/study`)
- Study mode picker
- UI
- Testing (Study screen)
- Rollout step 4

**Stacking:** branch `feat/dr-13-ios-46-study-screen-and-mode-picker`, created with `gh stack add` on top of `feat/mobile-google-sign-in` (PR #29). Publish with `gh stack submit`.

## Global Constraints

- **Core rules:** grading and deck building come from `@escritorio/core` (`isAnswerCorrect`, `eligibleCards`, `buildQuestion`, `configFromFields`, `parseStudySettings`, `exclusionReason`, `noEligibleCardsMessage`, `studyModeLabel`). Don't reimplement them in the app.
- **Answer field:** `autoCapitalize="none"`, `autoCorrect={false}`, `spellCheck={false}`, `returnKeyType="go"`, and the return key submits. The accented-character pad sits above the keyboard (`KeyboardAvoidingView`).
- **Haptics:** `expo-haptics` gives success on correct, warning on retry, and error on revealed.
- **Attempts:** 3 per card. A correct answer, or the 3rd wrong one, ends the card. One `quiz_attempts` row is written per card.
- **Mode picker:** changing mode, direction or visibility saves it on the device for that set, as web does. Nothing is written to `study_sets`. The quiz uses the same saved choice as the set page.
- **Writes:** sessions and attempts carry client-generated ids (`id`, `started_at` / `answered_at`). Core's upserts make a re-send a no-op.
- **UI:** NativeWind with the theme tokens in `global.css`. The theme follows the system light/dark setting.
- **Tests:** `jest-expo` + RNTL 14. `render`, `fireEvent` and `act` are async, so always `await` them.
- **Duplicates:** add native packages with `bunx expo install` only. Never duplicate React Native.
- **Commits:** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Rulings made while planning (spec gaps)

- **Writes are online-only in DR-13.** The offline queue is DR-14. Here, sessions and attempts go through an in-memory serial queue (`createStudyWriter`). Client ids are generated now, so DR-14 can persist the same ops unchanged.
- **The mode is kept on the device, matching web.** The spec said to save it to `study_sets`, but web stopped doing that in PR #11 ("so switching modes is instant and doesn't touch shared state"). The user wants both apps to behave the same, so the spec's `updateStudySetMode` op is dropped and no migration is needed. Each device starts from the set's own fields until the learner picks something there. The spec is updated to match.
- **Stored-setting parsing moves to core.** `studySettingsKey` and `parseStudySettings` live in `@escritorio/core`, and web's `studyConfigStorage.ts` uses them. The only change on web is that the stored direction and visibility must now be valid values, not just any string. A bad value falls back to the set's fields instead of producing a broken config.
- **The study screen is a full-screen modal with a "Close" button**, not a pushed screen with a header. This keeps `KeyboardAvoidingView` free of a header-height offset, and a quiz is a focused task.
- **An empty answer is ignored**, not counted as a wrong attempt (web counts it). A stray return-key press shouldn't use up one of the 3 attempts.
- **After a card ends, the return key goes to the next card.** The field stays focused, so the keyboard doesn't drop and come back between cards; typing into the finished card is ignored.
- **The completion summary shows the score** ("You got 3 of 5 right"). Web only says the deck is done.
- **Card order is the set's order, with no shuffling.** This matches web.
- **The accent pad has web's six letters** (á é í ó ú ñ). It's shown only when the answer is in Spanish, as on web.
- **Card rows on the set page show web's exclusion badge** ("No image", …) for cards the current mode skips.
- **The stale comment in `features/sets/hooks.ts`** says offline is "DR-15". It's DR-14; fix it in Task 6.

## Review Focus

1. **Cards refetch mid-session.** A focus refetch or a cache update must not restart the deck, change its length, or re-roll `random` directions. Pinned by a Task 5 test.
2. **Writes reach Supabase out of order.** An attempt sent before its session row exists fails the `session_id` foreign key. Writes must go one at a time, in the order they were made. Pinned by a Task 1 test.
3. **Empty or accidental return-key submit.** Submitting an empty field must not use up one of the 3 attempts. Pinned by a Task 3 test.
4. **Next tapped twice in one frame.** A double tap, or return plus a tap, must advance exactly one card. Pinned by a Task 3 test.
5. **Stored mode is missing, corrupt, or storage throws.** The set page and the quiz must fall back to the set's own fields, as web does, and must not get stuck loading. The quiz must also use the device's choice, not the set's fields, when both exist. Pinned by Task 4 tests (fallback) and a Task 5 test (the quiz uses the stored choice).

---

### Task 1: Ordered study writes (`createStudyWriter`) and client ids

**Files:**

- Create: `apps/mobile/src/lib/ids.ts`
- Create: `apps/mobile/src/features/study/createStudyWriter.ts`
- Create: `apps/mobile/src/features/study/studyWriter.ts`
- Test: `apps/mobile/src/features/study/createStudyWriter.test.ts`
- Modify: `apps/mobile/package.json`, `bun.lock` (via `bunx expo install expo-crypto`)

**Interfaces:**

- Consumes: `Api` from `@escritorio/core`:
  - `studySessions.createStudySession(input: StudySessionInput): Promise<StudySession | null>`
  - `studySessions.completeStudySession(id, { completed_at, cards_correct }): Promise<StudySession>`
  - `quizAttempts.createQuizAttempt(input: QuizAttemptInput): Promise<void>`
- Produces:
  - `newId(): string`, a v4 UUID (`@/lib/ids`)
  - `type StudyWriter = { startSession(input: StudySessionInput & { id: string; started_at: string }): void; recordAttempt(input: QuizAttemptInput & { id: string; answered_at: string }): void; completeSession(id: string, patch: { completed_at: string; cards_correct: number }): void; idle(): Promise<void> }`
  - `type StudyWritesApi`
  - `createStudyWriter(api: StudyWritesApi, onError?: (error: unknown) => void): StudyWriter`
  - `studyWriter: StudyWriter`, the app instance bound to `@/lib/api` (`@/features/study/studyWriter`)

- [ ] **Step 1: Install `expo-crypto`**

Run from `apps/mobile`: `bunx expo install expo-crypto`
Expected: `apps/mobile/package.json` gains `"expo-crypto": "~58.x.x"`. Then `bun pm why react-native` at the root still shows one version.

- [ ] **Step 2: Write the failing test**

`apps/mobile/src/features/study/createStudyWriter.test.ts`:

```ts
import type { QuizAttemptInput, StudySessionInput } from '@escritorio/core'
import { createStudyWriter } from './createStudyWriter'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function fakeApi() {
  const log: string[] = []
  const api = {
    studySessions: {
      createStudySession: jest.fn(async (input: StudySessionInput) => {
        log.push(`session ${input.id}`)
        return null
      }),
      completeStudySession: jest.fn(
        async (id: string, _patch: { completed_at: string; cards_correct: number }) => {
          log.push(`complete ${id}`)
          return {} as never
        },
      ),
    },
    quizAttempts: {
      createQuizAttempt: jest.fn(async (input: QuizAttemptInput) => {
        log.push(`attempt ${input.id}`)
      }),
    },
  }
  return { api, log }
}

const session = {
  id: 'sess-1',
  started_at: '2026-10-18T10:00:00.000Z',
  study_set_id: 's1',
  mode: 'conversion' as const,
  direction: 'es_en' as const,
  visibility: null,
  deck_size: 2,
}

const attempt = (id: string) => ({
  id,
  answered_at: '2026-10-18T10:01:00.000Z',
  card_id: 'c1',
  is_correct: true,
  attempt_count: 1,
  session_id: 'sess-1',
  resolved_direction: 'es_en' as const,
})

const done = { completed_at: '2026-10-18T10:05:00.000Z', cards_correct: 1 }

test('sends writes one at a time, in the order they were made', async () => {
  const { api, log } = fakeApi()
  const slow = deferred()
  api.studySessions.createStudySession.mockImplementationOnce(async (input) => {
    await slow.promise
    log.push(`session ${input.id}`)
    return null
  })
  const writer = createStudyWriter(api)

  writer.startSession(session)
  writer.recordAttempt(attempt('a1'))
  writer.completeSession('sess-1', done)

  // The session insert is still in flight: the attempt must wait for it,
  // or it would hit the session_id foreign key before the row exists.
  await Promise.resolve()
  await Promise.resolve()
  expect(api.quizAttempts.createQuizAttempt).not.toHaveBeenCalled()

  slow.resolve()
  await writer.idle()
  expect(log).toEqual(['session sess-1', 'attempt a1', 'complete sess-1'])
})

test('passes client ids and timestamps through unchanged', async () => {
  const { api } = fakeApi()
  const writer = createStudyWriter(api)

  writer.startSession(session)
  writer.recordAttempt(attempt('a1'))
  writer.completeSession('sess-1', done)
  await writer.idle()

  expect(api.studySessions.createStudySession).toHaveBeenCalledWith(session)
  expect(api.quizAttempts.createQuizAttempt).toHaveBeenCalledWith(attempt('a1'))
  expect(api.studySessions.completeStudySession).toHaveBeenCalledWith('sess-1', done)
})

test('reports a failed write and keeps sending the rest', async () => {
  const { api, log } = fakeApi()
  const onError = jest.fn()
  const failure = new Error('offline')
  api.studySessions.createStudySession.mockRejectedValueOnce(failure)
  const writer = createStudyWriter(api, onError)

  writer.startSession(session)
  writer.recordAttempt(attempt('a1'))
  await writer.idle()

  expect(onError).toHaveBeenCalledWith(failure)
  expect(log).toEqual(['attempt a1'])
})
```

- [ ] **Step 3: Run test to verify it fails**

Run from `apps/mobile`: `bunx jest src/features/study/createStudyWriter`
Expected: FAIL with "Cannot find module './createStudyWriter'".

- [ ] **Step 4: Write the implementation**

`apps/mobile/src/lib/ids.ts`:

```ts
import * as Crypto from 'expo-crypto'

/** A v4 UUID for rows the app creates itself (sessions, attempts). */
export function newId(): string {
  return Crypto.randomUUID()
}
```

`apps/mobile/src/features/study/createStudyWriter.ts`:

```ts
import type { Api, QuizAttemptInput, StudySessionInput } from '@escritorio/core'

export type StudyWritesApi = {
  studySessions: Pick<Api['studySessions'], 'createStudySession' | 'completeStudySession'>
  quizAttempts: Pick<Api['quizAttempts'], 'createQuizAttempt'>
}

export type StudyWriter = {
  startSession(input: StudySessionInput & { id: string; started_at: string }): void
  recordAttempt(input: QuizAttemptInput & { id: string; answered_at: string }): void
  completeSession(id: string, patch: { completed_at: string; cards_correct: number }): void
  /** Resolves once every write queued so far has settled. */
  idle(): Promise<void>
}

/**
 * Saves a study run's writes one at a time, in the order they were made:
 * an attempt must not reach Supabase before its session row exists. A
 * failed write is reported and skipped so the quiz never blocks on the
 * network. In-memory and online-only for now; DR-14 replaces this queue
 * with the persisted outbox (same ops, same client ids).
 */
export function createStudyWriter(
  api: StudyWritesApi,
  onError: (error: unknown) => void = (error) =>
    console.error('Failed to save study progress:', error),
): StudyWriter {
  let tail: Promise<void> = Promise.resolve()

  function enqueue(write: () => Promise<unknown>) {
    tail = tail.then(write).then(() => undefined, onError)
  }

  return {
    startSession: (input) => enqueue(() => api.studySessions.createStudySession(input)),
    recordAttempt: (input) => enqueue(() => api.quizAttempts.createQuizAttempt(input)),
    completeSession: (id, patch) =>
      enqueue(() => api.studySessions.completeStudySession(id, patch)),
    idle: () => tail,
  }
}
```

`apps/mobile/src/features/study/studyWriter.ts`:

```ts
import { api } from '@/lib/api'
import { createStudyWriter } from './createStudyWriter'

export const studyWriter = createStudyWriter(api)
```

- [ ] **Step 5: Run tests and typecheck**

Run from `apps/mobile`: `bunx jest src/features/study/createStudyWriter && bun run typecheck`
Expected: 3 tests PASS; `tsc --noEmit` prints no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/package.json bun.lock apps/mobile/src/lib/ids.ts apps/mobile/src/features/study
git commit -m "feat(mobile): ordered study writes with client ids

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Accent pad, cursor insertion and haptics

**Files:**

- Create: `apps/mobile/src/features/study/insertAtSelection.ts`
- Create: `apps/mobile/src/features/study/AccentPad.tsx`
- Create: `apps/mobile/src/lib/haptics.ts`
- Test: `apps/mobile/src/features/study/insertAtSelection.test.ts`, `apps/mobile/src/features/study/AccentPad.test.tsx`, `apps/mobile/src/lib/haptics.test.ts`
- Modify: `apps/mobile/package.json`, `bun.lock` (via `bunx expo install expo-haptics`)

**Interfaces:**

- Produces:
  - `type Selection = { start: number; end: number }`
  - `insertAtSelection(value: string, selection: Selection | null, text: string): { value: string; selection: Selection }`
  - `SPANISH_ACCENTS: readonly ['á', 'é', 'í', 'ó', 'ú', 'ñ']`
  - `<AccentPad onInsert={(char: string) => void} disabled?: boolean />`, whose buttons are named `Insert á` and so on
  - `type AnswerFeedback = 'correct' | 'retry' | 'revealed'` and `feedbackHaptic(feedback: AnswerFeedback): void` (`@/lib/haptics`)

- [ ] **Step 1: Install `expo-haptics`**

Run from `apps/mobile`: `bunx expo install expo-haptics`
Expected: `apps/mobile/package.json` gains `"expo-haptics": "~58.x.x"`.

- [ ] **Step 2: Write the failing tests**

`apps/mobile/src/features/study/insertAtSelection.test.ts`:

```ts
import { insertAtSelection } from './insertAtSelection'

test('inserts at the caret and moves the caret past the new letter', () => {
  expect(insertAtSelection('caa', { start: 2, end: 2 }, 'ñ')).toEqual({
    value: 'caña',
    selection: { start: 3, end: 3 },
  })
})

test('replaces a selected range', () => {
  expect(insertAtSelection('hola', { start: 1, end: 3 }, 'é')).toEqual({
    value: 'héa',
    selection: { start: 2, end: 2 },
  })
})

test('appends when the caret position is unknown', () => {
  expect(insertAtSelection('mama', null, 'á')).toEqual({
    value: 'mamaá',
    selection: { start: 5, end: 5 },
  })
})

test('clamps a stale selection that points past the end (e.g. after a retry cleared the field)', () => {
  expect(insertAtSelection('', { start: 4, end: 4 }, 'é')).toEqual({
    value: 'é',
    selection: { start: 1, end: 1 },
  })
})

test('handles a backwards selection', () => {
  expect(insertAtSelection('abc', { start: 3, end: 1 }, 'x')).toEqual({
    value: 'ax',
    selection: { start: 2, end: 2 },
  })
})
```

`apps/mobile/src/features/study/AccentPad.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { AccentPad, SPANISH_ACCENTS } from './AccentPad'

test('offers every Spanish accented letter', async () => {
  await render(<AccentPad onInsert={jest.fn()} />)
  for (const char of SPANISH_ACCENTS) {
    expect(screen.getByRole('button', { name: `Insert ${char}` })).toBeOnTheScreen()
  }
})

test('inserts the tapped letter', async () => {
  const onInsert = jest.fn()
  await render(<AccentPad onInsert={onInsert} />)
  await fireEvent.press(screen.getByRole('button', { name: 'Insert ñ' }))
  expect(onInsert).toHaveBeenCalledWith('ñ')
})

test('does nothing while disabled', async () => {
  const onInsert = jest.fn()
  await render(<AccentPad onInsert={onInsert} disabled />)
  await fireEvent.press(screen.getByRole('button', { name: 'Insert á' }))
  expect(onInsert).not.toHaveBeenCalled()
})
```

`apps/mobile/src/lib/haptics.test.ts`:

```ts
import * as Haptics from 'expo-haptics'
import { feedbackHaptic } from './haptics'

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}))

test.each([
  ['correct', 'success'],
  ['retry', 'warning'],
  ['revealed', 'error'],
] as const)('%s plays the %s notification', (feedback, type) => {
  feedbackHaptic(feedback)
  expect(Haptics.notificationAsync).toHaveBeenCalledWith(type)
})

test('a haptics failure never reaches the quiz', async () => {
  jest.mocked(Haptics.notificationAsync).mockRejectedValueOnce(new Error('no haptic engine'))
  expect(() => feedbackHaptic('correct')).not.toThrow()
  // Let the rejection settle; an unhandled rejection would fail the test run.
  await Promise.resolve()
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run from `apps/mobile`: `bunx jest src/features/study/insertAtSelection src/features/study/AccentPad src/lib/haptics`
Expected: FAIL with "Cannot find module" for each of the three.

- [ ] **Step 4: Write the implementation**

`apps/mobile/src/features/study/insertAtSelection.ts`:

```ts
export type Selection = { start: number; end: number }

/**
 * Inserts `text` at the caret (replacing any selected range) and returns
 * the new value with the caret just after the insertion. A null or stale
 * selection appends at the end.
 */
export function insertAtSelection(
  value: string,
  selection: Selection | null,
  text: string,
): { value: string; selection: Selection } {
  const clamp = (n: number) => Math.min(Math.max(n, 0), value.length)
  const a = clamp(selection?.start ?? value.length)
  const b = clamp(selection?.end ?? value.length)
  const from = Math.min(a, b)
  const to = Math.max(a, b)
  const caret = from + text.length
  return {
    value: value.slice(0, from) + text + value.slice(to),
    selection: { start: caret, end: caret },
  }
}
```

`apps/mobile/src/features/study/AccentPad.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native'

export const SPANISH_ACCENTS = ['á', 'é', 'í', 'ó', 'ú', 'ñ'] as const

/**
 * The accented letters Spanish uses, as a row that sits above the
 * keyboard. Pressables outside a ScrollView don't take focus, so the
 * answer field (and its keyboard) stays up while tapping these.
 */
export function AccentPad({
  onInsert,
  disabled = false,
}: {
  onInsert: (char: string) => void
  disabled?: boolean
}) {
  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Spanish accented characters"
      className="flex-row gap-2"
    >
      {SPANISH_ACCENTS.map((char) => (
        <Pressable
          key={char}
          accessibilityRole="button"
          accessibilityLabel={`Insert ${char}`}
          disabled={disabled}
          onPress={() => onInsert(char)}
          className="border-border bg-card h-11 flex-1 items-center justify-center rounded-lg border disabled:opacity-50"
        >
          <Text className="text-foreground text-lg">{char}</Text>
        </Pressable>
      ))}
    </View>
  )
}
```

`apps/mobile/src/lib/haptics.ts`:

```ts
import * as Haptics from 'expo-haptics'

export type AnswerFeedback = 'correct' | 'retry' | 'revealed'

const NOTIFICATION: Record<AnswerFeedback, Haptics.NotificationFeedbackType> = {
  correct: Haptics.NotificationFeedbackType.Success,
  retry: Haptics.NotificationFeedbackType.Warning,
  revealed: Haptics.NotificationFeedbackType.Error,
}

/** Fire-and-forget: a device without haptics must never break the quiz. */
export function feedbackHaptic(feedback: AnswerFeedback): void {
  Haptics.notificationAsync(NOTIFICATION[feedback]).catch(() => {})
}
```

- [ ] **Step 5: Run tests and typecheck**

Run from `apps/mobile`: `bunx jest src/features/study/insertAtSelection src/features/study/AccentPad src/lib/haptics && bun run typecheck`
Expected: 5 + 3 + 4 tests PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/package.json bun.lock apps/mobile/src/features/study apps/mobile/src/lib/haptics.ts apps/mobile/src/lib/haptics.test.ts
git commit -m "feat(mobile): accent pad, cursor insertion and answer haptics

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `QuizCard`: one card, 3 attempts

**Files:**

- Create: `apps/mobile/src/features/study/QuizCard.tsx`
- Create: `apps/mobile/src/test/fixtures.ts`
- Modify: `apps/mobile/jest.config.js` (add `clearMocks: true`)
- Test: `apps/mobile/src/features/study/QuizCard.test.tsx`

**Interfaces:**

- Consumes:
  - `insertAtSelection` and `Selection` (Task 2)
  - `AccentPad` (Task 2)
  - `feedbackHaptic` and `AnswerFeedback` (Task 2)
  - `isAnswerCorrect` and `Question` from core
- Produces:
  - `MAX_ATTEMPTS = 3`
  - `type AnswerResult = { isCorrect: boolean; attemptCount: number }`
  - `<QuizCard question={Question} imageUrl={string | null | undefined} onAnswered={(result: AnswerResult) => void} onNext={() => void} />`. The parent must key it per run and card, so its state resets.
  - `onAnswered` fires exactly once per card, when the card ends. `onNext` fires at most once.
  - Accessible names: the answer field `Your answer`; buttons `Check` / `Next`, `Show hint`, `Insert á` and so on.
  - Fixtures: `makeCard(overrides?: Partial<Card>): Card` and `makeStudySet(overrides?: Partial<StudySet>): StudySet` (`@/test/fixtures`)

- [ ] **Step 1: Clear mock calls between tests, and write the fixtures**

Module mocks (`jest.mock('@/lib/haptics', …)`) are shared by every test in a file. Without clearing, a `not.toHaveBeenCalled()` would see calls from earlier tests. Add `clearMocks: true` to `apps/mobile/jest.config.js`. It resets recorded calls only, so `jest.mock` factory implementations stay:

```js
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  clearMocks: true,
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transformIgnorePatterns: [
    '/node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|nativewind|react-native-css-interop))',
  ],
}
```

Run from `apps/mobile`: `bun run test`
Expected: every existing suite still PASSES.

`apps/mobile/src/test/fixtures.ts`:

```ts
import type { Card, StudySet } from '@escritorio/core'

const STAMP = '2026-10-01T00:00:00.000Z'

export function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    study_set_id: 's1',
    owner_id: 'u1',
    image_path: null,
    spanish_term: 'hablar',
    english_equivalent: 'to speak',
    definition: null,
    hint: null,
    position: 0,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  }
}

export function makeStudySet(overrides: Partial<StudySet> = {}): StudySet {
  return {
    id: 's1',
    owner_id: 'u1',
    title: 'Verbos',
    description: null,
    image_path: null,
    study_mode: 'conversion',
    conversion_direction: 'es_en',
    meaning_visibility: 'image',
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  }
}
```

- [ ] **Step 2: Write the failing test**

`apps/mobile/src/features/study/QuizCard.test.tsx`:

```tsx
import { buildQuestion, type Card } from '@escritorio/core'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { feedbackHaptic } from '@/lib/haptics'
import { makeCard } from '@/test/fixtures'
import { QuizCard } from './QuizCard'

jest.mock('@/lib/haptics', () => ({ feedbackHaptic: jest.fn() }))

// English prompt, Spanish answer: "to speak" → "hablar".
const toSpanish = (overrides: Partial<Card> = {}) =>
  buildQuestion(makeCard(overrides), { mode: 'conversion', direction: 'en_es' })

async function setup(question = toSpanish(), imageUrl?: string) {
  const onAnswered = jest.fn()
  const onNext = jest.fn()
  await render(
    <QuizCard question={question} imageUrl={imageUrl} onAnswered={onAnswered} onNext={onNext} />,
  )
  return { onAnswered, onNext }
}

const answerField = () => screen.getByLabelText('Your answer')

async function submit(text: string) {
  await fireEvent.changeText(answerField(), text)
  await fireEvent.press(screen.getByRole('button', { name: 'Check' }))
}

test('shows the prompt and accepts a correct answer, forgivingly', async () => {
  const { onAnswered, onNext } = await setup()
  expect(screen.getByText('to speak')).toBeOnTheScreen()

  await submit('  Hablar. ')

  expect(screen.getByText('Correct!')).toBeOnTheScreen()
  expect(onAnswered).toHaveBeenCalledWith({ isCorrect: true, attemptCount: 1 })
  expect(feedbackHaptic).toHaveBeenCalledWith('correct')
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }))
  expect(onNext).toHaveBeenCalledTimes(1)
})

test('gives three attempts, then reveals the answer', async () => {
  const { onAnswered } = await setup()

  await submit('comer')
  expect(screen.getByText('Not quite. 2 attempts left.')).toBeOnTheScreen()
  expect(answerField()).toHaveDisplayValue('')
  expect(feedbackHaptic).toHaveBeenLastCalledWith('retry')

  await submit('beber')
  expect(screen.getByText('Not quite. 1 attempt left.')).toBeOnTheScreen()

  await submit('vivir')
  expect(screen.getByText('Not quite. The answer was: hablar')).toBeOnTheScreen()
  expect(feedbackHaptic).toHaveBeenLastCalledWith('revealed')
  expect(onAnswered).toHaveBeenCalledTimes(1)
  expect(onAnswered).toHaveBeenCalledWith({ isCorrect: false, attemptCount: 3 })
  expect(screen.getByRole('button', { name: 'Next' })).toBeOnTheScreen()
})

test('a correct answer on the last attempt counts as correct', async () => {
  const { onAnswered } = await setup()
  await submit('comer')
  await submit('beber')
  await submit('hablar')
  expect(onAnswered).toHaveBeenCalledTimes(1)
  expect(onAnswered).toHaveBeenCalledWith({ isCorrect: true, attemptCount: 3 })
})

test('the return key submits', async () => {
  await setup()
  await fireEvent.changeText(answerField(), 'hablar')
  await fireEvent(answerField(), 'submitEditing')
  expect(screen.getByText('Correct!')).toBeOnTheScreen()
})

test('an empty answer is ignored rather than using up an attempt', async () => {
  const { onAnswered } = await setup()
  await submit('   ')
  expect(screen.queryByText(/Not quite/)).not.toBeOnTheScreen()
  expect(onAnswered).not.toHaveBeenCalled()
  expect(feedbackHaptic).not.toHaveBeenCalled()
})

test('the answer field turns off capitalization, autocorrect and spellcheck', async () => {
  await setup()
  expect(answerField().props).toMatchObject({
    autoCapitalize: 'none',
    autoCorrect: false,
    spellCheck: false,
    returnKeyType: 'go',
  })
})

test('the accent pad inserts at the cursor', async () => {
  await setup()
  await fireEvent.changeText(answerField(), 'caa')
  await fireEvent(answerField(), 'selectionChange', {
    nativeEvent: { selection: { start: 2, end: 2 } },
  })
  await fireEvent.press(screen.getByRole('button', { name: 'Insert ñ' }))
  expect(answerField()).toHaveDisplayValue('caña')
})

test('no accent pad when the answer is in English', async () => {
  await setup(buildQuestion(makeCard(), { mode: 'conversion', direction: 'es_en' }))
  expect(screen.queryByRole('button', { name: 'Insert á' })).not.toBeOnTheScreen()
})

test('shows the hint on request', async () => {
  await setup(toSpanish({ hint: 'starts with h' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Show hint' }))
  expect(screen.getByText('Hint: starts with h')).toBeOnTheScreen()
})

test('meaning mode shows the definition, not the word', async () => {
  await setup(
    buildQuestion(makeCard({ definition: 'emitir palabras' }), {
      mode: 'meaning',
      visibility: 'definition',
    }),
  )
  expect(screen.getByText('emitir palabras')).toBeOnTheScreen()
  expect(screen.queryByText('hablar')).not.toBeOnTheScreen()
})

test('shows a placeholder while the image URL loads', async () => {
  await setup(
    buildQuestion(makeCard({ image_path: 'u/c1.webp' }), { mode: 'meaning', visibility: 'image' }),
  )
  expect(screen.getByText('Loading image…')).toBeOnTheScreen()
})

test('two submits in one frame after the card ends advance only once', async () => {
  const { onNext } = await setup()
  await submit('hablar')
  const field = answerField()
  await act(async () => {
    field.props.onSubmitEditing()
    field.props.onSubmitEditing()
  })
  expect(onNext).toHaveBeenCalledTimes(1)
})

test('typing after the card ends does not change the shown answer', async () => {
  await setup()
  await submit('hablar')
  await fireEvent.changeText(answerField(), 'something else')
  expect(answerField()).toHaveDisplayValue('hablar')
})
```

- [ ] **Step 3: Run test to verify it fails**

Run from `apps/mobile`: `bunx jest src/features/study/QuizCard`
Expected: FAIL with "Cannot find module './QuizCard'".

- [ ] **Step 4: Write the implementation**

`apps/mobile/src/features/study/QuizCard.tsx`:

```tsx
import { isAnswerCorrect, type Question } from '@escritorio/core'
import { Image } from 'expo-image'
import { useRef, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { feedbackHaptic, type AnswerFeedback } from '@/lib/haptics'
import { AccentPad } from './AccentPad'
import { insertAtSelection, type Selection } from './insertAtSelection'

export const MAX_ATTEMPTS = 3

export type AnswerResult = { isCorrect: boolean; attemptCount: number }

/**
 * One quiz question. A wrong answer gets up to MAX_ATTEMPTS tries; a
 * correct answer or the last wrong one ends the card (onAnswered, once),
 * then Check becomes Next. The parent keys this per run and card, so all
 * state resets between cards.
 */
export function QuizCard({
  question,
  imageUrl,
  onAnswered,
  onNext,
}: {
  question: Question
  imageUrl: string | null | undefined
  onAnswered: (result: AnswerResult) => void
  onNext: () => void
}) {
  const { card } = question
  const [value, setValue] = useState('')
  const [selection, setSelection] = useState<Selection | null>(null)
  // Passed to the field only right after an accent insert, to move the
  // caret; cleared on the next selection change so typing stays native.
  const [forcedSelection, setForcedSelection] = useState<Selection | undefined>(undefined)
  const [attempts, setAttempts] = useState(0)
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null)
  const [hintShown, setHintShown] = useState(false)
  const advancedRef = useRef(false)
  const ended = feedback === 'correct' || feedback === 'revealed'

  function show(next: AnswerFeedback) {
    setFeedback(next)
    feedbackHaptic(next)
  }

  function submit() {
    if (ended) {
      // A double tap (or return + tap) in one frame must advance one card.
      if (advancedRef.current) return
      advancedRef.current = true
      onNext()
      return
    }
    if (value.trim() === '') return

    const attemptCount = attempts + 1
    if (isAnswerCorrect(value, question.expectedAnswer)) {
      show('correct')
      onAnswered({ isCorrect: true, attemptCount })
      return
    }

    setAttempts(attemptCount)
    if (attemptCount >= MAX_ATTEMPTS) {
      show('revealed')
      onAnswered({ isCorrect: false, attemptCount })
    } else {
      show('retry')
      setValue('')
      setSelection(null)
    }
  }

  function insert(char: string) {
    const next = insertAtSelection(value, selection, char)
    setValue(next.value)
    setSelection(next.selection)
    setForcedSelection(next.selection)
  }

  const attemptsLeft = MAX_ATTEMPTS - attempts

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
        keyboardShouldPersistTaps="handled"
      >
        {question.showImage && card.image_path ? (
          <View className="border-border bg-muted h-64 items-center justify-center overflow-hidden rounded-xl border">
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
                accessibilityLabel="Card image"
              />
            ) : (
              <Text className="text-muted-foreground text-sm">Loading image…</Text>
            )}
          </View>
        ) : null}

        {question.showDefinition && card.definition ? (
          <View className="border-border bg-muted rounded-xl border p-5">
            <Text className="text-foreground text-base leading-relaxed">{card.definition}</Text>
          </View>
        ) : null}

        {!question.showImage && !question.showDefinition ? (
          <View className="border-border bg-muted min-h-32 items-center justify-center rounded-xl border p-6">
            <Text className="text-foreground text-center text-2xl font-medium">
              {question.prompt}
            </Text>
          </View>
        ) : null}

        {card.hint ? (
          hintShown ? (
            <Text className="text-muted-foreground text-sm">Hint: {card.hint}</Text>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setHintShown(true)}>
              <Text className="text-muted-foreground text-sm underline">Show hint</Text>
            </Pressable>
          )
        ) : null}

        {feedback === 'correct' ? (
          <Text className="text-foreground text-base font-semibold">Correct!</Text>
        ) : null}
        {feedback === 'retry' ? (
          <Text className="text-destructive text-base font-semibold">
            {`Not quite. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.`}
          </Text>
        ) : null}
        {feedback === 'revealed' ? (
          <Text className="text-destructive text-base font-semibold">
            {`Not quite. The answer was: ${question.expectedAnswer}`}
          </Text>
        ) : null}
      </ScrollView>

      <View className="border-border gap-3 border-t p-4">
        {question.answerLanguage === 'es' ? <AccentPad disabled={ended} onInsert={insert} /> : null}
        <TextInput
          accessibilityLabel="Your answer"
          placeholder="Your answer"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          returnKeyType="go"
          // Keep the keyboard up across attempts and cards.
          submitBehavior="submit"
          value={value}
          onChangeText={(text) => {
            if (!ended) setValue(text)
          }}
          onSelectionChange={(e) => {
            setSelection(e.nativeEvent.selection)
            setForcedSelection(undefined)
          }}
          selection={forcedSelection}
          onSubmitEditing={submit}
          className="border-border bg-background text-foreground rounded-lg border px-3 py-3 text-lg"
        />
        <Pressable
          accessibilityRole="button"
          onPress={submit}
          className="bg-primary items-center rounded-lg py-3"
        >
          <Text className="text-primary-foreground text-base font-semibold">
            {ended ? 'Next' : 'Check'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
```

The retry and revealed messages are single template strings. React Native would otherwise split them into several text children, and `getByText('Not quite. 2 attempts left.')` needs the whole string.

- [ ] **Step 5: Run tests, typecheck, lint**

Run from `apps/mobile`: `bunx jest src/features/study/QuizCard && bun run typecheck`, then from the root: `bunx oxlint apps/mobile`
Expected: 13 tests PASS; no type errors; no new lint warnings (the two existing `AuthProvider.tsx` warnings remain).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/jest.config.js apps/mobile/src/features/study/QuizCard.tsx apps/mobile/src/features/study/QuizCard.test.tsx apps/mobile/src/test/fixtures.ts
git commit -m "feat(mobile): quiz card with 3 attempts, accent pad and haptics

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Per-device study settings (shared with web)

**Files:**

- Create: `packages/core/src/studySettings.ts`
- Test: `packages/core/src/studySettings.test.ts`
- Modify: `packages/core/src/index.ts` (export it)
- Modify: `apps/web/src/features/study/studyConfigStorage.ts` (use the core key and parser)
- Create: `apps/mobile/src/features/sets/studySettings.ts`
- Test: `apps/mobile/src/features/sets/studySettings.test.tsx`

**Interfaces:**

- Consumes:
  - `useStudySet(id)` from `@/features/sets/hooks`
  - `makeStudySet` (Task 3)
  - AsyncStorage, already a dependency and mocked in `jest.setup.js`
- Produces:
  - `@escritorio/core`:
    - `type StudySettings = Pick<StudySet, 'study_mode' | 'conversion_direction' | 'meaning_visibility'>`
    - `studySettingsKey(studySetId: string): string`, which returns `study-config:<id>` (web's existing key)
    - `parseStudySettings(raw: string | null): StudySettings | null`
  - `apps/mobile/src/features/sets/studySettings.ts`:
    - `useStudySettings(id: string): { settings: StudySettings | undefined; update: (patch: Partial<StudySettings>) => void }`
    - `settings` is `undefined` until both the stored value has been read and the set has loaded. The stored value wins; otherwise it's the set's own fields.

- [ ] **Step 1: Write the failing core test**

`packages/core/src/studySettings.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseStudySettings, studySettingsKey } from './studySettings'

const valid = { study_mode: 'meaning', conversion_direction: 'es_en', meaning_visibility: 'image' }

describe('studySettingsKey', () => {
  it("uses web's existing localStorage key", () => {
    expect(studySettingsKey('set-1')).toBe('study-config:set-1')
  })
})

describe('parseStudySettings', () => {
  it('reads a stored value', () => {
    expect(parseStudySettings(JSON.stringify(valid))).toEqual(valid)
  })

  it('keeps only the three settings fields', () => {
    expect(parseStudySettings(JSON.stringify({ ...valid, title: 'x' }))).toEqual(valid)
  })

  it.each([
    ['nothing stored', null],
    ['not JSON', '{oops'],
    ['not an object', '"meaning"'],
    ['an unknown mode', JSON.stringify({ ...valid, study_mode: 'typing' })],
    ['an unknown direction', JSON.stringify({ ...valid, conversion_direction: 'sideways' })],
    ['an unknown visibility', JSON.stringify({ ...valid, meaning_visibility: 'audio' })],
  ])('returns null for %s', (_label, raw) => {
    expect(parseStudySettings(raw)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run --filter @escritorio/core test -- studySettings`
Expected: FAIL with "Failed to resolve import './studySettings'".

- [ ] **Step 3: Write the core module**

`packages/core/src/studySettings.ts`:

```ts
import type { ConversionDirection, MeaningVisibility, StudyMode, StudySet } from './types/studySet'

/**
 * The study mode a learner picked for a set. Each device keeps its own
 * (web: localStorage, mobile: AsyncStorage) and falls back to the set's own
 * fields; it is never written to Supabase.
 */
export type StudySettings = Pick<
  StudySet,
  'study_mode' | 'conversion_direction' | 'meaning_visibility'
>

const MODES: readonly StudyMode[] = ['conversion', 'meaning']
const DIRECTIONS: readonly ConversionDirection[] = ['en_es', 'es_en', 'random']
const VISIBILITIES: readonly MeaningVisibility[] = ['image', 'definition', 'both']

export function studySettingsKey(studySetId: string): string {
  return `study-config:${studySetId}`
}

/** Returns null for anything that isn't a complete, valid stored value. */
export function parseStudySettings(raw: string | null): StudySettings | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { study_mode, conversion_direction, meaning_visibility } = parsed as Record<string, unknown>
  if (
    !MODES.includes(study_mode as StudyMode) ||
    !DIRECTIONS.includes(conversion_direction as ConversionDirection) ||
    !VISIBILITIES.includes(meaning_visibility as MeaningVisibility)
  ) {
    return null
  }
  return { study_mode, conversion_direction, meaning_visibility } as StudySettings
}
```

In `packages/core/src/index.ts`, add after `export * from './studyMode'`:

```ts
export * from './studySettings'
```

- [ ] **Step 4: Run the core tests**

Run: `bun run --filter @escritorio/core test`
Expected: PASS, including the 8 new tests. `index.test.ts` still passes. If it snapshots the export list, add the three new exports to it.

- [ ] **Step 5: Point web at the core key and parser**

Replace `apps/web/src/features/study/studyConfigStorage.ts` with:

```ts
import { parseStudySettings, studySettingsKey, type StudySettings } from '@escritorio/core'

export type StoredStudySettings = StudySettings

export function loadStudySettings(studySetId: string): StoredStudySettings | null {
  try {
    return parseStudySettings(localStorage.getItem(studySettingsKey(studySetId)))
  } catch {
    return null
  }
}

export function saveStudySettings(studySetId: string, settings: StoredStudySettings): void {
  try {
    localStorage.setItem(studySettingsKey(studySetId), JSON.stringify(settings))
  } catch {
    // Ignore write failures (e.g. private browsing) -- the setting just won't persist.
  }
}
```

Run: `bun run --filter @escritorio/web test && bun run --filter @escritorio/web typecheck`
Expected: PASS, no type errors. The callers (`StudySetPage`, `StudySessionPage`) are unchanged.

- [ ] **Step 6: Write the failing mobile test**

`apps/mobile/src/features/sets/studySettings.test.tsx`:

```tsx
import { studySettingsKey } from '@escritorio/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { api } from '@/lib/api'
import { makeStudySet } from '@/test/fixtures'
import { useStudySettings } from './studySettings'

jest.mock('@/lib/api', () => ({
  api: { studySets: { getStudySet: jest.fn(), updateStudySet: jest.fn() } },
}))

// makeStudySet's own fields: conversion, es_en, image.
const fromSet = {
  study_mode: 'conversion',
  conversion_direction: 'es_en',
  meaning_visibility: 'image',
}
const stored = { study_mode: 'meaning', conversion_direction: 'en_es', meaning_visibility: 'both' }

async function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return renderHook(() => useStudySettings('s1'), { wrapper })
}

beforeEach(async () => {
  await AsyncStorage.clear()
  jest.mocked(api.studySets.getStudySet).mockResolvedValue(makeStudySet())
})

test("falls back to the set's own fields when nothing is stored", async () => {
  const { result } = await setup()
  await waitFor(() => expect(result.current.settings).toEqual(fromSet))
})

test('a stored choice wins over the set', async () => {
  await AsyncStorage.setItem(studySettingsKey('s1'), JSON.stringify(stored))
  const { result } = await setup()
  await waitFor(() => expect(result.current.settings).toEqual(stored))
})

test("a corrupt stored value falls back to the set's fields", async () => {
  await AsyncStorage.setItem(studySettingsKey('s1'), '{oops')
  const { result } = await setup()
  await waitFor(() => expect(result.current.settings).toEqual(fromSet))
})

test("a storage read that throws falls back to the set's fields", async () => {
  jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk'))
  const { result } = await setup()
  await waitFor(() => expect(result.current.settings).toEqual(fromSet))
})

test('a change shows right away and is stored on the device, not in Supabase', async () => {
  const { result } = await setup()
  await waitFor(() => expect(result.current.settings).toBeDefined())

  await act(async () => result.current.update({ conversion_direction: 'random' }))

  const expected = { ...fromSet, conversion_direction: 'random' }
  expect(result.current.settings).toEqual(expected)
  expect(JSON.parse((await AsyncStorage.getItem(studySettingsKey('s1')))!)).toEqual(expected)
  expect(api.studySets.updateStudySet).not.toHaveBeenCalled()
})
```

- [ ] **Step 7: Run it to verify it fails**

Run from `apps/mobile`: `bunx jest src/features/sets/studySettings`
Expected: FAIL with "Cannot find module './studySettings'".

- [ ] **Step 8: Write the mobile hook**

`apps/mobile/src/features/sets/studySettings.ts`:

```ts
import { parseStudySettings, studySettingsKey, type StudySettings } from '@escritorio/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useStudySet } from './hooks'

const storedSettingsKey = (id: string) => ['study-settings', id] as const

async function loadStudySettings(id: string): Promise<StudySettings | null> {
  try {
    return parseStudySettings(await AsyncStorage.getItem(studySettingsKey(id)))
  } catch {
    return null
  }
}

async function saveStudySettings(id: string, settings: StudySettings): Promise<void> {
  try {
    await AsyncStorage.setItem(studySettingsKey(id), JSON.stringify(settings))
  } catch {
    // Ignore write failures; the choice just won't survive a restart.
  }
}

/**
 * The study mode for a set on this device, the same way web does it: a
 * choice made here wins, otherwise the set's own fields. Never written to
 * Supabase, so it works offline and doesn't change other devices.
 */
export function useStudySettings(id: string) {
  const queryClient = useQueryClient()
  const { data: studySet } = useStudySet(id)
  const stored = useQuery({
    queryKey: storedSettingsKey(id),
    queryFn: () => loadStudySettings(id),
    staleTime: Infinity,
    // Local storage: don't pause the read while the device is offline.
    networkMode: 'always',
  })

  const settings: StudySettings | undefined = !stored.isSuccess
    ? undefined
    : (stored.data ??
      (studySet && {
        study_mode: studySet.study_mode,
        conversion_direction: studySet.conversion_direction,
        meaning_visibility: studySet.meaning_visibility,
      }))

  function update(patch: Partial<StudySettings>) {
    if (!settings) return
    const next = { ...settings, ...patch }
    queryClient.setQueryData(storedSettingsKey(id), next)
    void saveStudySettings(id, next)
  }

  return { settings, update }
}
```

- [ ] **Step 9: Run tests, typecheck, lint, format**

Run from `apps/mobile`: `bunx jest src/features/sets && bun run typecheck`
Then from the root: `bun run test && bunx oxlint apps/mobile packages/core apps/web && bunx prettier --check apps/mobile/src packages/core/src apps/web/src/features/study`
Expected: 5 new mobile tests PASS. Every workspace's tests PASS, with no type errors and no new lint or formatting issues.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src apps/web/src/features/study/studyConfigStorage.ts apps/mobile/src/features/sets/studySettings.ts apps/mobile/src/features/sets/studySettings.test.tsx
git commit -m "feat: share per-device study settings between web and mobile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `StudyScreen` and the `/sets/[id]/study` route

**Files:**

- Create: `apps/mobile/src/features/study/StudyScreen.tsx`
- Test: `apps/mobile/src/features/study/StudyScreen.test.tsx`
- Move: `apps/mobile/src/app/(app)/sets/[id].tsx` → `apps/mobile/src/app/(app)/sets/[id]/index.tsx` (`git mv`, contents unchanged)
- Create: `apps/mobile/src/app/(app)/sets/[id]/study.tsx`
- Modify: `apps/mobile/src/app/(app)/_layout.tsx`
- Modify: `apps/mobile/src/test/renderWithQuery.tsx` (also return the `QueryClient`)

**Interfaces:**

- Consumes:
  - `StudyWriter` and `studyWriter` (Task 1)
  - `newId` (Task 1)
  - `QuizCard` and `AnswerResult` (Task 3)
  - `makeCard` and `makeStudySet` (Task 3)
  - `useStudySet`, `useCards`, `useSignedImageUrl` from `@/features/sets/hooks`
  - `useStudySettings(id)` (Task 4)
- Produces:
  - `<StudyScreen id={string} writer={StudyWriter} onClose={() => void} />`
  - The route `/sets/[id]/study`, a full-screen modal with no header
  - `renderWithQuery(ui)`, which now resolves to the RNTL result plus `client: QueryClient`

- [ ] **Step 1: Return the client from `renderWithQuery`**

Replace `apps/mobile/src/test/renderWithQuery.tsx` with:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react-native'
import type { ReactElement } from 'react'

export async function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  const result = await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
  return Object.assign(result, { client })
}
```

Run from `apps/mobile`: `bunx jest src/features/sets`
Expected: the existing set list and detail tests still PASS. They already `await renderWithQuery(...)`.

- [ ] **Step 2: Write the failing test**

`apps/mobile/src/features/study/StudyScreen.test.tsx`:

```tsx
import { noEligibleCardsMessage, queryKeys, studySettingsKey } from '@escritorio/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, screen } from '@testing-library/react-native'
import { api } from '@/lib/api'
import { newId } from '@/lib/ids'
import { makeCard, makeStudySet } from '@/test/fixtures'
import { renderWithQuery } from '@/test/renderWithQuery'
import type { StudyWriter } from './createStudyWriter'
import { StudyScreen } from './StudyScreen'

jest.mock('@/lib/api', () => ({
  api: {
    studySets: { getStudySet: jest.fn() },
    cards: { listCards: jest.fn() },
    cardImages: { getSignedImageUrl: jest.fn() },
  },
}))
jest.mock('@/lib/ids', () => ({ newId: jest.fn() }))
jest.mock('@/lib/haptics', () => ({ feedbackHaptic: jest.fn() }))
jest.mock('expo-image', () => {
  const actual = jest.requireActual('expo-image')
  actual.Image.prefetch = jest.fn(() => Promise.resolve(true))
  return actual
})

// Spanish prompt, English answer (conversion, es_en).
const hablar = makeCard({ id: 'c1', spanish_term: 'hablar', english_equivalent: 'to speak' })
const comer = makeCard({
  id: 'c2',
  spanish_term: 'comer',
  english_equivalent: 'to eat',
  position: 1,
})

function fakeWriter() {
  const calls: unknown[][] = []
  const writer: StudyWriter = {
    startSession: jest.fn((input) => {
      calls.push(['startSession', input])
    }),
    recordAttempt: jest.fn((input) => {
      calls.push(['recordAttempt', input])
    }),
    completeSession: jest.fn((id, patch) => {
      calls.push(['completeSession', id, patch])
    }),
    idle: jest.fn(() => Promise.resolve()),
  }
  return { writer, calls }
}

async function setup({ set = makeStudySet(), cards = [hablar, comer] } = {}) {
  jest.mocked(api.studySets.getStudySet).mockResolvedValue(set)
  jest.mocked(api.cards.listCards).mockResolvedValue(cards)
  const { writer, calls } = fakeWriter()
  const onClose = jest.fn()
  const { client } = await renderWithQuery(
    <StudyScreen id="s1" writer={writer} onClose={onClose} />,
  )
  return { writer, calls, onClose, client }
}

async function answer(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Your answer'), text)
  await fireEvent.press(screen.getByRole('button', { name: 'Check' }))
}

const next = () => fireEvent.press(screen.getByRole('button', { name: 'Next' }))

beforeEach(async () => {
  await AsyncStorage.clear()
  let n = 0
  jest.mocked(newId).mockImplementation(() => `id-${++n}`)
  jest.mocked(api.cardImages.getSignedImageUrl).mockResolvedValue('https://example.test/i.webp')
})

test('starts a session with a client id and the set mode before any attempt', async () => {
  const { writer } = await setup()
  expect(await screen.findByText('Card 1 of 2')).toBeOnTheScreen()
  expect(screen.getByText('hablar')).toBeOnTheScreen()
  expect(writer.startSession).toHaveBeenCalledWith({
    id: 'id-1',
    started_at: expect.any(String),
    study_set_id: 's1',
    mode: 'conversion',
    direction: 'es_en',
    visibility: null,
    deck_size: 2,
  })
})

test("uses this device's stored mode over the set's own fields", async () => {
  await AsyncStorage.setItem(
    studySettingsKey('s1'),
    JSON.stringify({
      study_mode: 'conversion',
      conversion_direction: 'en_es',
      meaning_visibility: 'image',
    }),
  )
  const { writer } = await setup()
  // English prompt now, instead of the set's Spanish → English.
  expect(await screen.findByText('to speak')).toBeOnTheScreen()
  expect(writer.startSession).toHaveBeenCalledWith(
    expect.objectContaining({ mode: 'conversion', direction: 'en_es' }),
  )
})

test('records one attempt per card, in order, then completes the session', async () => {
  const { calls } = await setup()
  await screen.findByText('Card 1 of 2')

  await answer('to speak')
  await next()
  expect(screen.getByText('Card 2 of 2')).toBeOnTheScreen()
  await answer('x')
  await answer('y')
  await answer('z')
  await next()

  expect(screen.getByText('You got 1 of 2 right in "Verbos".')).toBeOnTheScreen()
  expect(calls.map((call) => call[0])).toEqual([
    'startSession',
    'recordAttempt',
    'recordAttempt',
    'completeSession',
  ])
  expect(calls[1][1]).toEqual({
    id: 'id-2',
    answered_at: expect.any(String),
    card_id: 'c1',
    is_correct: true,
    attempt_count: 1,
    session_id: 'id-1',
    resolved_direction: 'es_en',
  })
  expect(calls[2][1]).toMatchObject({
    id: 'id-3',
    card_id: 'c2',
    is_correct: false,
    attempt_count: 3,
    session_id: 'id-1',
  })
  expect(calls[3]).toEqual([
    'completeSession',
    'id-1',
    { completed_at: expect.any(String), cards_correct: 1 },
  ])
})

test('a cards refetch mid-session does not restart or resize the deck', async () => {
  const { client } = await setup()
  await screen.findByText('Card 1 of 2')
  await answer('to speak')
  await next()

  const extra = makeCard({ id: 'c3', spanish_term: 'vivir', english_equivalent: 'to live' })
  await act(async () => {
    client.setQueryData(queryKeys.cards('s1'), [hablar, comer, extra])
  })

  expect(screen.getByText('Card 2 of 2')).toBeOnTheScreen()
  expect(screen.getByText('comer')).toBeOnTheScreen()
})

test('"Study again" starts a fresh session and a fresh first card', async () => {
  const { writer } = await setup({ cards: [hablar] })
  await screen.findByText('Card 1 of 1')
  await answer('to speak')
  await next()

  await fireEvent.press(screen.getByRole('button', { name: 'Study again' }))

  expect(writer.startSession).toHaveBeenCalledTimes(2)
  expect(jest.mocked(writer.startSession).mock.calls[1][0].id).toBe('id-3')
  expect(screen.getByText('Card 1 of 1')).toBeOnTheScreen()
  expect(screen.getByLabelText('Your answer')).toHaveDisplayValue('')
  expect(screen.getByRole('button', { name: 'Check' })).toBeOnTheScreen()
})

test('explains an empty deck and starts no session', async () => {
  const set = makeStudySet({ study_mode: 'meaning', meaning_visibility: 'image' })
  const { writer } = await setup({ set })
  expect(
    await screen.findByText(noEligibleCardsMessage({ mode: 'meaning', visibility: 'image' })),
  ).toBeOnTheScreen()
  expect(writer.startSession).not.toHaveBeenCalled()
})

test('says so when the set fails to load, and Close still works', async () => {
  jest.mocked(api.studySets.getStudySet).mockRejectedValue(new Error('offline'))
  jest.mocked(api.cards.listCards).mockResolvedValue([hablar])
  const onClose = jest.fn()
  const { writer } = fakeWriter()
  await renderWithQuery(<StudyScreen id="s1" writer={writer} onClose={onClose} />)

  expect(
    await screen.findByText("Couldn't load this set. Check your connection."),
  ).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalled()
})
```

- [ ] **Step 3: Run test to verify it fails**

Run from `apps/mobile`: `bunx jest src/features/study/StudyScreen`
Expected: FAIL with "Cannot find module './StudyScreen'".

- [ ] **Step 4: Write `StudyScreen`**

`apps/mobile/src/features/study/StudyScreen.tsx`:

```tsx
import {
  buildQuestion,
  configFromFields,
  eligibleCards,
  noEligibleCardsMessage,
  type Card,
  type Question,
  type StudyConfig,
  type StudySet,
  type StudySettings,
} from '@escritorio/core'
import { Image } from 'expo-image'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { KeyboardAvoidingView, Pressable, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { useCards, useSignedImageUrl, useStudySet } from '@/features/sets/hooks'
import { useStudySettings } from '@/features/sets/studySettings'
import { newId } from '@/lib/ids'
import type { StudyWriter } from './createStudyWriter'
import { QuizCard, type AnswerResult } from './QuizCard'

type Run = { sessionId: string | null; config: StudyConfig; questions: Question[] }

const now = () => new Date().toISOString()

function imagePathFor(question: Question | undefined): string | null {
  return question?.showImage ? question.card.image_path : null
}

function Centered({ children }: { children: ReactNode }) {
  return <View className="flex-1 items-center justify-center gap-4 px-6">{children}</View>
}

export function StudyScreen({
  id,
  writer,
  onClose,
}: {
  id: string
  writer: StudyWriter
  onClose: () => void
}) {
  const { data: studySet, isError: setFailed } = useStudySet(id)
  const { data: cards, isError: cardsFailed } = useCards(id)
  const { settings } = useStudySettings(id)
  const [run, setRun] = useState<Run | null>(null)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const startedRef = useRef(false)

  function start(set: StudySet, deckCards: Card[], chosen: StudySettings) {
    const config = configFromFields(chosen)
    // Built once per run: rebuilding on a refetch would restart the deck
    // and re-roll 'random' directions mid-session.
    const questions = eligibleCards(deckCards, config).map((card) => buildQuestion(card, config))
    let sessionId: string | null = null
    if (questions.length > 0) {
      sessionId = newId()
      writer.startSession({
        id: sessionId,
        started_at: now(),
        study_set_id: set.id,
        mode: config.mode,
        direction: config.mode === 'conversion' ? config.direction : null,
        visibility: config.mode === 'meaning' ? config.visibility : null,
        deck_size: questions.length,
      })
    }
    setRun({ sessionId, config, questions })
    setIndex(0)
    setCorrect(0)
  }

  useEffect(() => {
    if (startedRef.current || !studySet || !cards || !settings) return
    startedRef.current = true
    start(studySet, cards, settings)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the set, cards and settings first load
  }, [studySet, cards, settings])

  const question = run?.questions[index]
  const { data: imageUrl } = useSignedImageUrl(imagePathFor(question))
  const { data: nextImageUrl } = useSignedImageUrl(imagePathFor(run?.questions[index + 1]))
  useEffect(() => {
    if (nextImageUrl) Image.prefetch(nextImageUrl).catch(() => {})
  }, [nextImageUrl])

  function handleAnswered(result: AnswerResult) {
    if (!run || !question) return
    writer.recordAttempt({
      id: newId(),
      answered_at: now(),
      card_id: question.card.id,
      is_correct: result.isCorrect,
      attempt_count: result.attemptCount,
      session_id: run.sessionId,
      resolved_direction: question.resolvedDirection,
    })
    if (result.isCorrect) setCorrect((c) => c + 1)
  }

  function handleNext() {
    if (!run) return
    const nextIndex = index + 1
    if (nextIndex >= run.questions.length && run.sessionId) {
      writer.completeSession(run.sessionId, { completed_at: now(), cards_correct: correct })
    }
    setIndex(nextIndex)
  }

  const total = run?.questions.length ?? 0
  const finished = run != null && total > 0 && index >= total

  let body: ReactNode
  if (setFailed || cardsFailed) {
    body = (
      <Centered>
        <Text className="text-muted-foreground text-center">
          Couldn't load this set. Check your connection.
        </Text>
      </Centered>
    )
  } else if (!run) {
    body = (
      <Centered>
        <Text className="text-muted-foreground">Loading…</Text>
      </Centered>
    )
  } else if (total === 0) {
    body = (
      <Centered>
        <Text className="text-foreground text-center">{noEligibleCardsMessage(run.config)}</Text>
        <Text className="text-muted-foreground text-center">
          You can change the study mode on the set's page.
        </Text>
      </Centered>
    )
  } else if (finished) {
    body = (
      <Centered>
        <Text className="text-foreground text-2xl font-semibold">Nice work!</Text>
        <Text className="text-muted-foreground text-center">
          {`You got ${correct} of ${total} right in "${studySet?.title ?? ''}".`}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => studySet && cards && settings && start(studySet, cards, settings)}
          className="border-border bg-background w-full items-center rounded-lg border py-3"
        >
          <Text className="text-foreground text-base font-semibold">Study again</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          className="bg-primary w-full items-center rounded-lg py-3"
        >
          <Text className="text-primary-foreground text-base font-semibold">Done</Text>
        </Pressable>
      </Centered>
    )
  } else if (question) {
    body = (
      <QuizCard
        key={`${run.sessionId}:${question.card.id}`}
        question={question}
        imageUrl={imageUrl}
        onAnswered={handleAnswered}
        onNext={handleNext}
      />
    )
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8} className="w-16">
            <Text className="text-foreground text-base">Close</Text>
          </Pressable>
          {total > 0 && !finished ? (
            <Text className="text-muted-foreground text-sm">{`Card ${index + 1} of ${total}`}</Text>
          ) : null}
          <View className="w-16" />
        </View>
        {body}
      </KeyboardAvoidingView>
    </Screen>
  )
}
```

- [ ] **Step 5: Run the screen test**

Run from `apps/mobile`: `bunx jest src/features/study/StudyScreen`
Expected: 7 tests PASS.

- [ ] **Step 6: Add the route**

Run from the repo root:

```bash
mkdir -p "apps/mobile/src/app/(app)/sets/[id]"
git mv "apps/mobile/src/app/(app)/sets/[id].tsx" "apps/mobile/src/app/(app)/sets/[id]/index.tsx"
```

`apps/mobile/src/app/(app)/sets/[id]/study.tsx`:

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StudyScreen } from '@/features/study/StudyScreen'
import { studyWriter } from '@/features/study/studyWriter'

export default function StudyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  return <StudyScreen id={id} writer={studyWriter} onClose={() => router.back()} />
}
```

Replace `apps/mobile/src/app/(app)/_layout.tsx` with:

```tsx
import { Stack } from 'expo-router'

export default function SignedInLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Study sets', headerLargeTitle: true }} />
      <Stack.Screen name="sets/[id]/index" options={{ title: '' }} />
      {/* A focused task with its own Close button; no header means the
          KeyboardAvoidingView needs no header-height offset. */}
      <Stack.Screen
        name="sets/[id]/study"
        options={{ presentation: 'fullScreenModal', headerShown: false }}
      />
    </Stack>
  )
}
```

- [ ] **Step 7: Regenerate typed routes, typecheck, bundle**

Run from `apps/mobile`: `bun run export:ios && bun run typecheck && rm -rf dist-export`
Expected: the export succeeds, which also regenerates `.expo/types/router.d.ts` with `/sets/[id]/study`; then no type errors.

- [ ] **Step 8: Run all mobile tests**

Run from `apps/mobile`: `bun run test`
Expected: all suites PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/features/study apps/mobile/src/test/renderWithQuery.tsx "apps/mobile/src/app/(app)"
git commit -m "feat(mobile): study screen with session lifecycle and completion summary

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Mode picker, exclusion badges and the Study button on the set page

**Files:**

- Create: `apps/mobile/src/features/sets/StudyModePicker.tsx`
- Modify: `apps/mobile/src/features/sets/SetDetailScreen.tsx`
- Modify: `apps/mobile/src/features/sets/hooks.ts` (comment only: "DR-15" → "DR-14")
- Modify: `apps/mobile/src/app/(app)/sets/[id]/index.tsx`
- Test: `apps/mobile/src/features/sets/SetDetailScreen.test.tsx`

**Interfaces:**

- Consumes:
  - `useStudySettings(id)` and `type StudySettings` (Task 4)
  - `makeCard` and `makeStudySet` (Task 3)
  - the route `/sets/[id]/study` (Task 5)
- Produces:
  - `<StudyModePicker settings={StudySettings} onChange={(patch: Partial<StudySettings>) => void} />`. Its options are buttons with `accessibilityState.selected`.
  - `<SetDetailScreen id={string} onStudy={() => void} />`

- [ ] **Step 1: Write the failing tests**

Replace `apps/mobile/src/features/sets/SetDetailScreen.test.tsx` with:

```tsx
import { noEligibleCardsMessage, studySettingsKey } from '@escritorio/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, screen } from '@testing-library/react-native'
import { api } from '@/lib/api'
import { makeCard, makeStudySet } from '@/test/fixtures'
import { renderWithQuery } from '@/test/renderWithQuery'
import { SetDetailScreen } from './SetDetailScreen'

jest.mock('@/lib/api', () => ({
  api: {
    studySets: { getStudySet: jest.fn(), updateStudySet: jest.fn() },
    cards: { listCards: jest.fn() },
    cardImages: { getSignedImageUrl: jest.fn() },
  },
}))

const hablar = makeCard({ id: 'c1', spanish_term: 'hablar', english_equivalent: 'to speak' })
const comer = makeCard({
  id: 'c2',
  spanish_term: 'comer',
  english_equivalent: null,
  definition: 'ingerir alimentos',
  image_path: 'u/c2.webp',
})

async function setup({
  set = makeStudySet({ description: 'Common verbs' }),
  cards = [hablar, comer],
} = {}) {
  jest.mocked(api.studySets.getStudySet).mockResolvedValue(set)
  jest.mocked(api.cards.listCards).mockResolvedValue(cards)
  const onStudy = jest.fn()
  await renderWithQuery(<SetDetailScreen id="s1" onStudy={onStudy} />)
  await screen.findByText('Verbos')
  return { onStudy }
}

beforeEach(async () => {
  await AsyncStorage.clear()
  jest.mocked(api.cardImages.getSignedImageUrl).mockResolvedValue('https://example.test/img.webp')
})

test('shows the title, card count and a read-only card preview', async () => {
  await setup()
  expect(await screen.findByText('2 cards')).toBeOnTheScreen()
  expect(screen.getByText('Common verbs')).toBeOnTheScreen()
  expect(screen.getByText('hablar')).toBeOnTheScreen()
  expect(screen.getByText('to speak')).toBeOnTheScreen()
  expect(screen.getByText('ingerir alimentos')).toBeOnTheScreen()
  expect(api.cardImages.getSignedImageUrl).toHaveBeenCalledWith('u/c2.webp')
})

test('uses the singular for one card', async () => {
  await setup({ cards: [hablar] })
  expect(await screen.findByText('1 card')).toBeOnTheScreen()
})

test("shows the set's current mode and direction as selected", async () => {
  await setup()
  expect(
    await screen.findByRole('button', { name: 'Word conversion', selected: true }),
  ).toBeOnTheScreen()
  expect(
    screen.getByRole('button', { name: 'Spanish → English', selected: true }),
  ).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Random', selected: false })).toBeOnTheScreen()
})

test('changing the direction shows it right away and keeps it on this device', async () => {
  await setup()
  await fireEvent.press(await screen.findByRole('button', { name: 'Random' }))
  expect(screen.getByRole('button', { name: 'Random', selected: true })).toBeOnTheScreen()
  expect(JSON.parse((await AsyncStorage.getItem(studySettingsKey('s1')))!)).toMatchObject({
    conversion_direction: 'random',
  })
  expect(api.studySets.updateStudySet).not.toHaveBeenCalled()
})

test('switching to Definition to word shows its visibility options', async () => {
  await setup()
  await fireEvent.press(await screen.findByRole('button', { name: 'Definition to word' }))
  expect(screen.getByRole('button', { name: 'Show image', selected: true })).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Show definition' })).toBeOnTheScreen()
})

test("opens with this device's stored choice", async () => {
  await AsyncStorage.setItem(
    studySettingsKey('s1'),
    JSON.stringify({
      study_mode: 'conversion',
      conversion_direction: 'random',
      meaning_visibility: 'image',
    }),
  )
  await setup()
  expect(await screen.findByRole('button', { name: 'Random', selected: true })).toBeOnTheScreen()
})

test('marks cards the current mode skips', async () => {
  await setup({ set: makeStudySet({ study_mode: 'meaning', meaning_visibility: 'image' }) })
  // hablar has no image; comer has one.
  expect(await screen.findByText('No image')).toBeOnTheScreen()
  expect(screen.getAllByText('No image')).toHaveLength(1)
})

test('Study opens the quiz', async () => {
  const { onStudy } = await setup()
  await fireEvent.press(await screen.findByRole('button', { name: 'Study' }))
  expect(onStudy).toHaveBeenCalled()
})

test('Study is disabled, with the reason, when the mode leaves no cards', async () => {
  // hablar has neither an image nor a definition, so "Show both" skips it.
  const { onStudy } = await setup({
    set: makeStudySet({ study_mode: 'meaning', meaning_visibility: 'both' }),
    cards: [hablar],
  })
  expect(
    await screen.findByText(noEligibleCardsMessage({ mode: 'meaning', visibility: 'both' })),
  ).toBeOnTheScreen()
  const study = screen.getByRole('button', { name: 'Study' })
  expect(study).toBeDisabled()
  await fireEvent.press(study)
  expect(onStudy).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/mobile`: `bunx jest src/features/sets/SetDetailScreen`
Expected:

- The two existing preview tests PASS.
- The new ones FAIL; for example, "Unable to find an element with role: button, name: Word conversion".
- TypeScript isn't run by jest, so the missing `onStudy` prop doesn't fail the run.

- [ ] **Step 3: Write `StudyModePicker`**

`apps/mobile/src/features/sets/StudyModePicker.tsx`:

```tsx
import {
  studyModeLabel,
  type ConversionDirection,
  type MeaningVisibility,
  type StudyMode,
} from '@escritorio/core'
import { Pressable, Text, View } from 'react-native'
import type { StudySettings } from '@escritorio/core'

type Option<T extends string> = { value: T; label: string }

const MODE_OPTIONS: Option<StudyMode>[] = [
  { value: 'conversion', label: studyModeLabel('conversion') },
  { value: 'meaning', label: studyModeLabel('meaning') },
]

// Same options and copy as the web picker (apps/web/.../StudyModePicker.tsx).
const DIRECTION_OPTIONS: Option<ConversionDirection>[] = [
  { value: 'en_es', label: 'English → Spanish' },
  { value: 'es_en', label: 'Spanish → English' },
  { value: 'random', label: 'Random' },
]

const VISIBILITY_OPTIONS: Option<MeaningVisibility>[] = [
  { value: 'image', label: 'Show image' },
  { value: 'definition', label: 'Show definition' },
  { value: 'both', label: 'Show both' },
]

function Segmented<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: Option<T>[]
  value: T
  onSelect: (value: T) => void
}) {
  return (
    <View className="bg-muted flex-row rounded-lg p-1">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) onSelect(option.value)
            }}
            className={`flex-1 items-center justify-center rounded-md px-1 py-2 ${selected ? 'bg-background' : ''}`}
          >
            <Text
              className={`text-center text-sm ${selected ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function StudyModePicker({
  settings,
  onChange,
}: {
  settings: StudySettings
  onChange: (patch: Partial<StudySettings>) => void
}) {
  return (
    <View className="gap-2">
      <Segmented
        options={MODE_OPTIONS}
        value={settings.study_mode}
        onSelect={(study_mode) => onChange({ study_mode })}
      />
      {settings.study_mode === 'conversion' ? (
        <Segmented
          options={DIRECTION_OPTIONS}
          value={settings.conversion_direction}
          onSelect={(conversion_direction) => onChange({ conversion_direction })}
        />
      ) : (
        <Segmented
          options={VISIBILITY_OPTIONS}
          value={settings.meaning_visibility}
          onSelect={(meaning_visibility) => onChange({ meaning_visibility })}
        />
      )}
    </View>
  )
}
```

- [ ] **Step 4: Update `SetDetailScreen`**

Replace `apps/mobile/src/features/sets/SetDetailScreen.tsx` with:

```tsx
import {
  configFromFields,
  eligibleCards,
  exclusionReason,
  noEligibleCardsMessage,
  type Card,
  type StudyConfig,
} from '@escritorio/core'
import { Image } from 'expo-image'
import { FlatList, Pressable, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { useCards, useSignedImageUrl, useStudySet } from './hooks'
import { StudyModePicker } from './StudyModePicker'
import { useStudySettings } from './studySettings'

function CardRow({ card, config }: { card: Card; config: StudyConfig | null }) {
  const { data: imageUrl } = useSignedImageUrl(card.image_path)
  const meaning = card.english_equivalent ?? card.definition
  const excluded = config ? exclusionReason(card, config) : null
  return (
    <View className="border-border flex-row items-center gap-3 border-b px-4 py-3">
      {card.image_path ? (
        <Image
          source={imageUrl ? { uri: imageUrl } : null}
          style={{ width: 48, height: 48, borderRadius: 8 }}
          contentFit="cover"
        />
      ) : null}
      <View className="flex-1">
        <Text className="text-foreground text-base font-medium">{card.spanish_term}</Text>
        {meaning ? <Text className="text-muted-foreground">{meaning}</Text> : null}
      </View>
      {excluded ? (
        <View className="bg-muted rounded-md px-2 py-1">
          <Text className="text-muted-foreground text-xs">{excluded}</Text>
        </View>
      ) : null}
    </View>
  )
}

export function SetDetailScreen({ id, onStudy }: { id: string; onStudy: () => void }) {
  const { data: studySet } = useStudySet(id)
  const { data: cards } = useCards(id)
  const { settings, update } = useStudySettings(id)
  const count = cards?.length
  const config = settings ? configFromFields(settings) : null
  const eligibleCount = config && cards ? eligibleCards(cards, config).length : 0

  return (
    <Screen>
      <FlatList<Card>
        contentInsetAdjustmentBehavior="automatic"
        data={cards ?? []}
        keyExtractor={(card) => card.id}
        ListHeaderComponent={
          <View className="gap-3 px-4 py-4">
            <View className="gap-1">
              <Text className="text-foreground text-2xl font-bold">{studySet?.title ?? ''}</Text>
              {studySet?.description ? (
                <Text className="text-muted-foreground">{studySet.description}</Text>
              ) : null}
              {count != null ? (
                <Text className="text-muted-foreground">
                  {count === 1 ? '1 card' : `${count} cards`}
                </Text>
              ) : null}
            </View>

            {settings ? (
              <>
                <StudyModePicker settings={settings} onChange={update} />
                <Pressable
                  accessibilityRole="button"
                  disabled={eligibleCount === 0}
                  onPress={onStudy}
                  className="bg-primary items-center rounded-lg py-3 disabled:opacity-50"
                >
                  <Text className="text-primary-foreground text-base font-semibold">Study</Text>
                </Pressable>
                {config && cards && eligibleCount === 0 ? (
                  <Text className="text-muted-foreground text-sm">
                    {noEligibleCardsMessage(config)}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <CardRow card={item} config={config} />}
      />
    </Screen>
  )
}
```

In `apps/mobile/src/features/sets/hooks.ts`, change the first comment line to:

```ts
// Online-only for now; DR-14 persists this cache and mirrors images for offline use.
```

Replace `apps/mobile/src/app/(app)/sets/[id]/index.tsx` with:

```tsx
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SetDetailScreen } from '@/features/sets/SetDetailScreen'

export default function SetDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  return (
    <SetDetailScreen
      id={id}
      onStudy={() => router.push({ pathname: '/sets/[id]/study', params: { id } })}
    />
  )
}
```

- [ ] **Step 5: Run tests, typecheck, lint, format, bundle**

Run from `apps/mobile`: `bunx jest src/features/sets && bun run typecheck && bun run export:ios && rm -rf dist-export`
Then from the root: `bun run test && bunx oxlint apps/mobile && bunx prettier --check apps/mobile/src docs/superpowers/plans`
Expected:

- 9 SetDetailScreen tests PASS.
- Every workspace's tests PASS.
- No type errors, the export succeeds, and no new lint warnings or formatting issues.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/sets "apps/mobile/src/app/(app)/sets/[id]/index.tsx"
git commit -m "feat(mobile): study mode picker, exclusion badges and Study button

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## On-device check (after Task 6, in the dev build or Expo Go)

1. Open a set and switch the mode, direction and visibility. Each change shows at once, including in airplane mode. Force-quit and reopen the app: the set keeps the choice. The web app's mode for that set is unchanged, as it would be with a second browser.
2. Tap **Study**. The quiz opens full screen with the keyboard up and the accent pad sitting just above it.
3. Tapping **ñ** mid-word inserts it at the cursor and the keyboard stays up.
4. Correct, retry and revealed answers each give a different haptic.
5. Finish the deck. The summary's score matches, and in Supabase the `study_sessions` row has `completed_at` and `cards_correct`, with one `quiz_attempts` row per card carrying its `session_id`.
6. **Study again** starts a new session. **Close** returns to the set.
