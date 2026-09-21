# Study Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a learner pick between two study modes (conversion:
EN↔ES word drill; meaning: definition/image→ES) with an inline
configurable setting per mode, persisted per study set, and logged
per-session for future success-rate analytics.

**Architecture:** A pure, framework-free module (`studyMode.ts`) owns
all mode/eligibility/question-building logic and is unit tested
directly. Mode + setting are plain columns on `study_sets`, edited via
a new dumb `StudyModePicker` component and persisted through the
existing `patchStudySet` mutation/`useSaveStatus` pattern already used
for title/description. A new `study_sessions` table records one row
per run (mode, setting, deck size, completion); `quiz_attempts` gains
a nullable `session_id` + `resolved_direction`. `QuizCard` becomes
presentational over a `Question` (built by `studyMode.ts`) instead of
a raw `Card`.

**Tech Stack:** React 19, TypeScript, TanStack Query, Supabase
(Postgres + RLS), Tailwind, radix-ui primitives (already a
dependency — no new packages), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-20-study-modes-design.md`

## Global Constraints

- Enum values exactly: `study_mode` = `'conversion' | 'meaning'`;
  `conversion_direction` = `'en_es' | 'es_en' | 'random'`;
  `meaning_visibility` = `'image' | 'definition' | 'both'`.
- `study_sets` defaults: `study_mode = 'meaning'`,
  `conversion_direction = 'en_es'`, `meaning_visibility = 'both'` —
  every existing set must keep behaving exactly as it does today.
- Meaning-mode eligibility is **strict**: `'both'` requires the card
  to have **both** `image_path` and `definition` (the narrowest deck,
  not the widest).
- `study_sessions` needs an owner-scoped **update** policy (unlike the
  append-only `quiz_attempts`), restricted to `completed_at` /
  `cards_answered` only.
- `resolved_direction` on `quiz_attempts` is set only for
  conversion-mode attempts; null otherwise.
- No new npm/bun packages — `dropdown-menu` and `toggle-group` UI
  primitives are hand-written against the already-installed
  `radix-ui` meta-package, following the exact style of
  `src/components/ui/dialog.tsx` and `src/components/ui/tooltip.tsx`.
- Manual/Supabase-side verification (applying the migration, RLS
  behavior, live app testing) is **left to the user** — do not attempt
  to run `supabase` CLI commands or claim that layer is tested.
- Gate every task on `bun run lint`, `bun test` (vitest), and
  `bun run build` (`tsc -b && vite build`) all passing, per project
  scripts in `package.json`.

---

## Task 1: Migration + type updates

**Files:**
- Create: `supabase/migrations/0006_study_modes.sql`
- Modify: `src/types/studySet.ts`
- Modify: `src/types/quizAttempt.ts`
- Create: `src/types/studySession.ts`

**Interfaces:**
- Produces: `StudyMode`, `ConversionDirection`, `MeaningVisibility`
  type unions (in `src/types/studySet.ts`); `StudySet` gains
  `study_mode: StudyMode`, `conversion_direction: ConversionDirection`,
  `meaning_visibility: MeaningVisibility`; `StudySetInput` gains the
  same three fields, optional (`?:`) since callers patch a subset.
  `QuizAttemptInput` gains `session_id: string | null` and
  `resolved_direction: ConversionDirection | null`. New
  `src/types/studySession.ts` exports `StudySession` and
  `StudySessionInput`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0006_study_modes.sql`:

```sql
-- Adds selectable study modes: 'conversion' (EN<->ES word drill) and
-- 'meaning' (definition/image -> ES, today's existing behavior).
-- study_sets carries the persisted picker state; study_sessions logs
-- one row per study run for future favorite-mode/success-rate
-- analytics; quiz_attempts gains enough context to join back to it.

create type public.study_mode as enum ('conversion', 'meaning');
create type public.conversion_direction as enum ('en_es', 'es_en', 'random');
create type public.meaning_visibility as enum ('image', 'definition', 'both');

-- Defaults preserve today's fixed behavior (image + definition ->
-- typed Spanish answer) for every existing study set.
alter table public.study_sets
  add column study_mode study_mode not null default 'meaning',
  add column conversion_direction conversion_direction not null default 'en_es',
  add column meaning_visibility meaning_visibility not null default 'both';

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  study_set_id uuid not null references public.study_sets (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  mode study_mode not null,
  direction conversion_direction,
  visibility meaning_visibility,
  deck_size integer not null,
  cards_answered integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint study_sessions_direction_matches_mode
    check ((mode = 'conversion') = (direction is not null)),
  constraint study_sessions_visibility_matches_mode
    check ((mode = 'meaning') = (visibility is not null))
);

create index study_sessions_study_set_id_idx on public.study_sessions (study_set_id);
create index study_sessions_owner_id_idx on public.study_sessions (owner_id);

-- Mirrors cards_set_owner_id / set_quiz_attempt_lineage: force owner_id
-- to match the referenced study set, regardless of what the client
-- sends, so a client can't misattribute a session to someone else's set.
create or replace function public.set_study_session_lineage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select owner_id
  into new.owner_id
  from public.study_sets
  where id = new.study_set_id;

  if new.owner_id is null then
    raise exception 'study_set_id % does not exist', new.study_set_id;
  end if;

  return new;
end;
$$;

create trigger study_sessions_set_lineage
  before insert on public.study_sessions
  for each row
  execute function public.set_study_session_lineage();

-- Unlike quiz_attempts (strictly append-only), a session row is opened
-- at start and closed at completion. This trigger pins every column
-- except completed_at/cards_answered to its original value, so an
-- update can never rewrite a session into a different mode/config.
create or replace function public.guard_study_session_update()
returns trigger
language plpgsql
as $$
begin
  new.study_set_id := old.study_set_id;
  new.owner_id := old.owner_id;
  new.mode := old.mode;
  new.direction := old.direction;
  new.visibility := old.visibility;
  new.deck_size := old.deck_size;
  new.started_at := old.started_at;
  return new;
end;
$$;

create trigger study_sessions_guard_update
  before update on public.study_sessions
  for each row
  execute function public.guard_study_session_update();

alter table public.study_sessions enable row level security;

create policy "study_sessions_select_own"
  on public.study_sessions for select
  using (owner_id = auth.uid());

create policy "study_sessions_insert_own"
  on public.study_sessions for insert
  with check (owner_id = auth.uid());

create policy "study_sessions_update_own"
  on public.study_sessions for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

alter table public.quiz_attempts
  add column session_id uuid references public.study_sessions (id) on delete set null,
  add column resolved_direction conversion_direction;

create index quiz_attempts_session_id_idx on public.quiz_attempts (session_id);
```

- [ ] **Step 2: Update `src/types/studySet.ts`**

```ts
export type StudyMode = 'conversion' | 'meaning'
export type ConversionDirection = 'en_es' | 'es_en' | 'random'
export type MeaningVisibility = 'image' | 'definition' | 'both'

export interface StudySet {
  id: string
  owner_id: string
  title: string
  description: string | null
  image_path: string | null
  study_mode: StudyMode
  conversion_direction: ConversionDirection
  meaning_visibility: MeaningVisibility
  created_at: string
  updated_at: string
}

export interface StudySetInput {
  title: string
  description: string | null
  image_path?: string | null
  study_mode?: StudyMode
  conversion_direction?: ConversionDirection
  meaning_visibility?: MeaningVisibility
}
```

- [ ] **Step 3: Update `src/types/quizAttempt.ts`**

```ts
import type { ConversionDirection } from './studySet'

export interface QuizAttemptInput {
  card_id: string
  is_correct: boolean
  attempt_count: number
  session_id: string | null
  resolved_direction: ConversionDirection | null
}
```

- [ ] **Step 4: Create `src/types/studySession.ts`**

```ts
import type { ConversionDirection, MeaningVisibility, StudyMode } from './studySet'

export interface StudySession {
  id: string
  study_set_id: string
  owner_id: string
  mode: StudyMode
  direction: ConversionDirection | null
  visibility: MeaningVisibility | null
  deck_size: number
  cards_answered: number
  started_at: string
  completed_at: string | null
}

export interface StudySessionInput {
  study_set_id: string
  mode: StudyMode
  direction: ConversionDirection | null
  visibility: MeaningVisibility | null
  deck_size: number
}
```

- [ ] **Step 5: Verify the project still builds and lints**

Run: `bun run lint && bun run build`
Expected: both succeed with no errors (existing call sites that
construct `QuizAttemptInput` will now fail type-checking until Task 9
updates them — if `bun run build` fails only on
`src/features/study/QuizCard.tsx`'s `logAttempt.mutate(...)` calls
missing `session_id`/`resolved_direction`, that is expected at this
point in the plan; confirm no *other* file fails).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0006_study_modes.sql src/types/studySet.ts src/types/quizAttempt.ts src/types/studySession.ts
git commit -m "feat: add study modes migration and types

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Study mode logic (`studyMode.ts`)

**Files:**
- Create: `src/features/study/studyMode.ts`
- Test: `src/features/study/studyMode.test.ts`

**Interfaces:**
- Consumes: `Card` (`src/types/card.ts`), `StudyMode`,
  `ConversionDirection`, `MeaningVisibility` (`src/types/studySet.ts`).
- Produces (used by Tasks 5, 6, 8, 9):
  ```ts
  export type StudyConfig =
    | { mode: 'conversion'; direction: ConversionDirection }
    | { mode: 'meaning'; visibility: MeaningVisibility }

  export type Question = {
    card: Card
    prompt: string
    expectedAnswer: string
    answerLanguage: 'en' | 'es'
    resolvedDirection: 'en_es' | 'es_en' | null
    showImage: boolean
    showDefinition: boolean
  }

  export function isCardEligible(card: Card, config: StudyConfig): boolean
  export function eligibleCards(cards: Card[], config: StudyConfig): Card[]
  export function exclusionReason(card: Card, config: StudyConfig): string | null
  export function buildQuestion(card: Card, config: StudyConfig, rng?: () => number): Question
  ```

- [ ] **Step 1: Write the failing tests**

Create `src/features/study/studyMode.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Card } from '@/types/card'
import { buildQuestion, eligibleCards, exclusionReason, isCardEligible } from './studyMode'

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    study_set_id: 'set-1',
    owner_id: 'owner-1',
    image_path: null,
    spanish_term: 'perro',
    english_equivalent: null,
    definition: null,
    hint: null,
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('isCardEligible / conversion', () => {
  it('requires a non-empty english_equivalent', () => {
    const withEnglish = makeCard({ english_equivalent: 'dog' })
    const withoutEnglish = makeCard({ english_equivalent: null })
    const config = { mode: 'conversion' as const, direction: 'en_es' as const }
    expect(isCardEligible(withEnglish, config)).toBe(true)
    expect(isCardEligible(withoutEnglish, config)).toBe(false)
  })

  it('is eligible regardless of which direction is configured', () => {
    const card = makeCard({ english_equivalent: 'dog' })
    expect(isCardEligible(card, { mode: 'conversion', direction: 'es_en' })).toBe(true)
    expect(isCardEligible(card, { mode: 'conversion', direction: 'random' })).toBe(true)
  })
})

describe('isCardEligible / meaning', () => {
  const imageOnly = makeCard({ image_path: 'img.jpg', definition: null })
  const definitionOnly = makeCard({ image_path: null, definition: 'a small animal' })
  const both = makeCard({ image_path: 'img.jpg', definition: 'a small animal' })
  const neither = makeCard({ image_path: null, definition: null })

  it("'image' visibility requires image_path", () => {
    const config = { mode: 'meaning' as const, visibility: 'image' as const }
    expect(isCardEligible(imageOnly, config)).toBe(true)
    expect(isCardEligible(definitionOnly, config)).toBe(false)
  })

  it("'definition' visibility requires definition", () => {
    const config = { mode: 'meaning' as const, visibility: 'definition' as const }
    expect(isCardEligible(definitionOnly, config)).toBe(true)
    expect(isCardEligible(imageOnly, config)).toBe(false)
  })

  it("'both' visibility strictly requires both fields (narrowest deck)", () => {
    const config = { mode: 'meaning' as const, visibility: 'both' as const }
    expect(isCardEligible(both, config)).toBe(true)
    expect(isCardEligible(imageOnly, config)).toBe(false)
    expect(isCardEligible(definitionOnly, config)).toBe(false)
    expect(isCardEligible(neither, config)).toBe(false)
  })
})

describe('eligibleCards', () => {
  it('filters out ineligible cards, preserving order', () => {
    const cards = [
      makeCard({ id: 'a', english_equivalent: 'dog' }),
      makeCard({ id: 'b', english_equivalent: null }),
      makeCard({ id: 'c', english_equivalent: 'cat' }),
    ]
    const result = eligibleCards(cards, { mode: 'conversion', direction: 'en_es' })
    expect(result.map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('can return an empty deck when no cards qualify', () => {
    const cards = [
      makeCard({ image_path: 'img.jpg', definition: null }),
      makeCard({ image_path: null, definition: 'def' }),
    ]
    const result = eligibleCards(cards, { mode: 'meaning', visibility: 'both' })
    expect(result).toEqual([])
  })
})

describe('exclusionReason', () => {
  it('returns null for an eligible card', () => {
    const card = makeCard({ english_equivalent: 'dog' })
    expect(exclusionReason(card, { mode: 'conversion', direction: 'en_es' })).toBeNull()
  })

  it('names the missing field for conversion mode', () => {
    const card = makeCard({ english_equivalent: null })
    expect(exclusionReason(card, { mode: 'conversion', direction: 'en_es' })).toBe(
      'No English equivalent',
    )
  })

  it('names the missing field(s) for meaning mode', () => {
    const imageOnly = makeCard({ image_path: 'img.jpg', definition: null })
    const definitionOnly = makeCard({ image_path: null, definition: 'def' })
    const neither = makeCard({ image_path: null, definition: null })
    expect(exclusionReason(imageOnly, { mode: 'meaning', visibility: 'definition' })).toBe(
      'No definition',
    )
    expect(exclusionReason(definitionOnly, { mode: 'meaning', visibility: 'image' })).toBe(
      'No image',
    )
    expect(exclusionReason(imageOnly, { mode: 'meaning', visibility: 'both' })).toBe(
      'No definition',
    )
    expect(exclusionReason(neither, { mode: 'meaning', visibility: 'both' })).toBe(
      'No image or definition',
    )
  })
})

describe('buildQuestion / conversion', () => {
  const card = makeCard({ spanish_term: 'perro', english_equivalent: 'dog' })

  it('en_es: prompts with English, expects Spanish', () => {
    const q = buildQuestion(card, { mode: 'conversion', direction: 'en_es' })
    expect(q.prompt).toBe('dog')
    expect(q.expectedAnswer).toBe('perro')
    expect(q.answerLanguage).toBe('es')
    expect(q.resolvedDirection).toBe('en_es')
  })

  it('es_en: prompts with Spanish, expects English', () => {
    const q = buildQuestion(card, { mode: 'conversion', direction: 'es_en' })
    expect(q.prompt).toBe('perro')
    expect(q.expectedAnswer).toBe('dog')
    expect(q.answerLanguage).toBe('en')
    expect(q.resolvedDirection).toBe('es_en')
  })

  it("random: resolves to en_es when rng() < 0.5", () => {
    const q = buildQuestion(card, { mode: 'conversion', direction: 'random' }, () => 0.1)
    expect(q.resolvedDirection).toBe('en_es')
    expect(q.prompt).toBe('dog')
  })

  it("random: resolves to es_en when rng() >= 0.5", () => {
    const q = buildQuestion(card, { mode: 'conversion', direction: 'random' }, () => 0.9)
    expect(q.resolvedDirection).toBe('es_en')
    expect(q.prompt).toBe('perro')
  })
})

describe('buildQuestion / meaning', () => {
  const card = makeCard({
    spanish_term: 'perro',
    image_path: 'img.jpg',
    definition: 'a small animal',
  })

  it('always expects the Spanish term, in Spanish', () => {
    const q = buildQuestion(card, { mode: 'meaning', visibility: 'both' })
    expect(q.expectedAnswer).toBe('perro')
    expect(q.answerLanguage).toBe('es')
    expect(q.resolvedDirection).toBeNull()
  })

  it("'image' visibility shows only the image", () => {
    const q = buildQuestion(card, { mode: 'meaning', visibility: 'image' })
    expect(q.showImage).toBe(true)
    expect(q.showDefinition).toBe(false)
  })

  it("'definition' visibility shows only the definition", () => {
    const q = buildQuestion(card, { mode: 'meaning', visibility: 'definition' })
    expect(q.showImage).toBe(false)
    expect(q.showDefinition).toBe(true)
  })

  it("'both' visibility shows both", () => {
    const q = buildQuestion(card, { mode: 'meaning', visibility: 'both' })
    expect(q.showImage).toBe(true)
    expect(q.showDefinition).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun test src/features/study/studyMode.test.ts`
Expected: FAIL — `studyMode.ts` does not exist yet (module not found).

- [ ] **Step 3: Implement `src/features/study/studyMode.ts`**

```ts
import type { Card } from '@/types/card'
import type { ConversionDirection, MeaningVisibility, StudyMode } from '@/types/studySet'

export type StudyConfig =
  | { mode: 'conversion'; direction: ConversionDirection }
  | { mode: 'meaning'; visibility: MeaningVisibility }

export type Question = {
  card: Card
  /** The word/definition shown to the learner. */
  prompt: string
  expectedAnswer: string
  /** Language the learner is expected to type their answer in. */
  answerLanguage: 'en' | 'es'
  /** The concrete direction this card was asked in -- set only for
   * conversion mode (a fixed value, even under 'random'), null for
   * meaning mode. */
  resolvedDirection: 'en_es' | 'es_en' | null
  showImage: boolean
  showDefinition: boolean
}

function hasText(value: string | null): value is string {
  return value != null && value.trim().length > 0
}

/**
 * Whether a card can be asked at all under the given mode/setting.
 * Meaning-mode 'both' is strict: it requires BOTH image and
 * definition, making it the narrowest deck under meaning mode, not
 * the widest.
 */
export function isCardEligible(card: Card, config: StudyConfig): boolean {
  if (config.mode === 'conversion') {
    return hasText(card.english_equivalent)
  }

  switch (config.visibility) {
    case 'image':
      return hasText(card.image_path)
    case 'definition':
      return hasText(card.definition)
    case 'both':
      return hasText(card.image_path) && hasText(card.definition)
  }
}

export function eligibleCards(cards: Card[], config: StudyConfig): Card[] {
  return cards.filter((card) => isCardEligible(card, config))
}

/** Copy for the per-card exclusion badge; null when the card is eligible. */
export function exclusionReason(card: Card, config: StudyConfig): string | null {
  if (isCardEligible(card, config)) return null

  if (config.mode === 'conversion') {
    return 'No English equivalent'
  }

  const missingImage = !hasText(card.image_path)
  const missingDefinition = !hasText(card.definition)

  if (config.visibility === 'image') return 'No image'
  if (config.visibility === 'definition') return 'No definition'

  // visibility === 'both'
  if (missingImage && missingDefinition) return 'No image or definition'
  if (missingImage) return 'No image'
  return 'No definition'
}

/**
 * Builds the question shown for a single card under the given config.
 * `rng` resolves conversion mode's 'random' direction per card --
 * inject a seeded function in tests for deterministic results. Not
 * used outside conversion mode.
 */
export function buildQuestion(
  card: Card,
  config: StudyConfig,
  rng: () => number = Math.random,
): Question {
  if (config.mode === 'conversion') {
    const direction: 'en_es' | 'es_en' =
      config.direction === 'random' ? (rng() < 0.5 ? 'en_es' : 'es_en') : config.direction

    return direction === 'en_es'
      ? {
          card,
          prompt: card.english_equivalent!,
          expectedAnswer: card.spanish_term,
          answerLanguage: 'es',
          resolvedDirection: 'en_es',
          showImage: false,
          showDefinition: false,
        }
      : {
          card,
          prompt: card.spanish_term,
          expectedAnswer: card.english_equivalent!,
          answerLanguage: 'en',
          resolvedDirection: 'es_en',
          showImage: false,
          showDefinition: false,
        }
  }

  return {
    card,
    prompt: card.spanish_term,
    expectedAnswer: card.spanish_term,
    answerLanguage: 'es',
    resolvedDirection: null,
    showImage: config.visibility === 'image' || config.visibility === 'both',
    showDefinition: config.visibility === 'definition' || config.visibility === 'both',
  }
}

export function studyModeLabel(mode: StudyMode): string {
  return mode === 'conversion' ? 'Word conversion' : 'Definition to word'
}
```

Note: for meaning mode, `prompt` is set to `card.spanish_term` but is
not the text actually rendered on screen — `QuizCard` (Task 9) renders
the image/definition per `showImage`/`showDefinition` instead of
`prompt` for meaning-mode questions. `prompt` is meaningful for
conversion mode only; meaning mode's visual is driven by
`showImage`/`showDefinition` plus the card's own `image_path`/
`definition`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun test src/features/study/studyMode.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Lint and typecheck**

Run: `bun run lint && bun run build`
Expected: `studyMode.ts`/`studyMode.test.ts` introduce no new errors
(the pre-existing `QuizCard.tsx` build error from Task 1 is still
expected here and resolved in Task 9).

- [ ] **Step 6: Commit**

```bash
git add src/features/study/studyMode.ts src/features/study/studyMode.test.ts
git commit -m "feat: add study mode eligibility and question-building logic

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `dropdown-menu` and `toggle-group` UI primitives

**Files:**
- Create: `src/components/ui/dropdown-menu.tsx`
- Create: `src/components/ui/toggle-group.tsx`

**Interfaces:**
- Consumes: `cn` from `'cn'` (see `src/components/ui/dialog.tsx` for
  the import), `radix-ui`'s `DropdownMenu` and `ToggleGroup` /
  `Toggle` namespaces (already available via the `radix-ui` package —
  do not run `npx shadcn add` or any network-fetching command; write
  these by hand in the same style as the existing generated files
  under `src/components/ui/`).
- Produces (used by Task 4): `DropdownMenu`, `DropdownMenuTrigger`,
  `DropdownMenuContent`, `DropdownMenuRadioGroup`,
  `DropdownMenuRadioItem` from `dropdown-menu.tsx`; `ToggleGroup`,
  `ToggleGroupItem` from `toggle-group.tsx`.

- [ ] **Step 1: Create `src/components/ui/dropdown-menu.tsx`**

```tsx
import * as React from 'react'
import { CheckIcon, ChevronRightIcon, CircleIcon } from 'lucide-react'
import { cn } from 'cn'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'

function DropdownMenu({ ...props }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />
}

function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          'bg-popover text-popover-foreground data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 ring-foreground/10 z-50 min-w-40 overflow-hidden rounded-lg p-1 shadow-md ring-1 duration-100',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return <DropdownMenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        'hover:bg-muted focus:bg-muted relative flex cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-8 text-sm outline-none select-none',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        'hover:bg-muted focus:bg-muted relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none select-none',
        className,
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
}
// CheckIcon / ChevronRightIcon retained for future submenu/checkbox
// items; unused for now but kept importable in one place.
export { CheckIcon, ChevronRightIcon }
```

- [ ] **Step 2: Create `src/components/ui/toggle-group.tsx`**

```tsx
import * as React from 'react'
import { cn } from 'cn'
import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui'

function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(
        'ring-foreground/10 inline-flex items-center gap-0.5 rounded-lg p-0.5 ring-1',
        className,
      )}
      {...props}
    />
  )
}

function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        'text-muted-foreground hover:text-foreground data-on:bg-background data-on:text-foreground data-on:shadow-sm rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-150 outline-none',
        className,
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
```

Note: radix-ui's `ToggleGroup.Item` exposes pressed state via
`data-state="on"|"off"`, not a boolean `data-on` attribute — if
`bun run build`/manual check shows the `data-on:` Tailwind variants
don't apply, replace them with `data-[state=on]:bg-background
data-[state=on]:text-foreground data-[state=on]:shadow-sm` (matching
the `data-open:`/`data-closed:` pattern already used in
`dialog.tsx`/`tooltip.tsx`, which are themselves `data-state` under
the hood via Tailwind's `data-*` arbitrary variants).

- [ ] **Step 3: Verify it compiles and lints**

Run: `bun run lint && bun run build`
Expected: no new errors from these two files (both currently unused,
so no import-related failures; the pre-existing `QuizCard.tsx` error
from Task 1 is still expected).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/dropdown-menu.tsx src/components/ui/toggle-group.tsx
git commit -m "feat: add dropdown-menu and toggle-group UI primitives

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `StudyModePicker` component

**Files:**
- Create: `src/features/study-sets/StudyModePicker.tsx`

**Interfaces:**
- Consumes: `StudyConfig`, `studyModeLabel` (Task 2, `studyMode.ts`);
  `StudyMode`, `ConversionDirection`, `MeaningVisibility` (Task 1,
  `studySet.ts`); `DropdownMenu*` (Task 3); `ToggleGroup*` (Task 3);
  `Button` (`src/components/ui/button.tsx`, existing).
- Produces (used by Task 5):
  ```ts
  export function StudyModePicker({
    config,
    onChange,
    eligibleCount,
    totalCount,
    onStart,
  }: {
    config: StudyConfig
    onChange: (config: StudyConfig) => void
    eligibleCount: number
    totalCount: number
    onStart: () => void
  }): JSX.Element
  ```
  This is a **dumb** component: no data fetching, no persistence — it
  reports the new `StudyConfig` via `onChange` and lets the parent
  decide what to do with it, matching the memory preference for
  presentational shared components with persistence lifted to the
  parent.

- [ ] **Step 1: Implement the component**

```tsx
import { ChevronDown, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { StudyConfig } from '@/features/study/studyMode'
import { studyModeLabel } from '@/features/study/studyMode'
import type { ConversionDirection, MeaningVisibility, StudyMode } from '@/types/studySet'

const DIRECTION_OPTIONS: { value: ConversionDirection; label: string }[] = [
  { value: 'en_es', label: 'English → Spanish' },
  { value: 'es_en', label: 'Spanish → English' },
  { value: 'random', label: 'Random' },
]

const VISIBILITY_OPTIONS: { value: MeaningVisibility; label: string }[] = [
  { value: 'image', label: 'Show image' },
  { value: 'definition', label: 'Show definition' },
  { value: 'both', label: 'Show both' },
]

export function StudyModePicker({
  config,
  onChange,
  eligibleCount,
  totalCount,
  onStart,
}: {
  config: StudyConfig
  onChange: (config: StudyConfig) => void
  eligibleCount: number
  totalCount: number
  onStart: () => void
}) {
  function selectMode(mode: StudyMode) {
    if (mode === config.mode) return
    onChange(
      mode === 'conversion'
        ? { mode: 'conversion', direction: 'en_es' }
        : { mode: 'meaning', visibility: 'both' },
    )
  }

  const canStart = eligibleCount > 0
  const startLabel =
    eligibleCount === totalCount
      ? 'Start studying'
      : `Start studying · ${eligibleCount} of ${totalCount} cards`

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex items-stretch gap-0.5">
        <Button size="lg" className="h-10 rounded-r-none" disabled={!canStart} onClick={onStart}>
          <Play data-icon="inline-start" />
          {startLabel}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              variant="outline"
              className="h-10 rounded-l-none border-l-0 px-2"
              aria-label="Choose study mode"
            >
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={config.mode}
              onValueChange={(value) => selectMode(value as StudyMode)}
            >
              <DropdownMenuRadioItem value="conversion">
                {studyModeLabel('conversion')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="meaning">
                {studyModeLabel('meaning')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {config.mode === 'conversion' ? (
        <ToggleGroup
          type="single"
          value={config.direction}
          onValueChange={(value) => {
            if (value) onChange({ mode: 'conversion', direction: value as ConversionDirection })
          }}
        >
          {DIRECTION_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : (
        <ToggleGroup
          type="single"
          value={config.visibility}
          onValueChange={(value) => {
            if (value) onChange({ mode: 'meaning', visibility: value as MeaningVisibility })
          }}
        >
          {VISIBILITY_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {!canStart && (
        <p className="text-muted-foreground text-xs sm:text-right">
          No cards are eligible for this mode/setting — try a different one.
        </p>
      )}
    </div>
  )
}
```

`ToggleGroup`'s `onValueChange` fires with `''` when the currently
pressed item is clicked again (radix single-select toggles off) — the
`if (value)` guards keep at least one option always selected, since
this setting must never be empty.

- [ ] **Step 2: Lint and typecheck**

Run: `bun run lint && bun run build`
Expected: no new errors from this file (it's not imported anywhere
yet, so this only checks it in isolation for syntax/type errors —
`tsc` still type-checks unreferenced files in this project since
there's no `noUnusedLocals`-style exclusion of unreferenced files;
confirm no errors are reported against `StudyModePicker.tsx`
specifically).

- [ ] **Step 3: Commit**

```bash
git add src/features/study-sets/StudyModePicker.tsx
git commit -m "feat: add StudyModePicker component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Wire the picker into `StudySetPage` with persistence

**Files:**
- Modify: `src/features/study-sets/StudySetPage.tsx`
- Modify: `src/features/study-sets/CardsSection.tsx`

**Interfaces:**
- Consumes: `StudyModePicker` (Task 4); `StudyConfig`, `eligibleCards`
  (Task 2, `studyMode.ts`); `usePatchStudySet` (existing,
  `src/features/study-sets/hooks/useStudySets.ts`); `useCards`
  (existing).
- Produces (used by Task 6): `CardsSection` gains a `config:
  StudyConfig` prop it forwards down to `EditableCardTile`.

- [ ] **Step 1: Add a `StudyConfig` ⇄ `StudySet` conversion in `StudySetPage.tsx`**

In `src/features/study-sets/StudySetPage.tsx`, add near the top (after
the existing imports) a small local helper — this file already
composes several such helpers (`relativeTime`), so this follows the
existing pattern rather than introducing a new shared module for two
one-line conversions:

```ts
import type { StudyConfig } from '@/features/study/studyMode'
import { eligibleCards } from '@/features/study/studyMode'
import type { StudySet } from '@/types/studySet'

function configFromStudySet(studySet: StudySet): StudyConfig {
  return studySet.study_mode === 'conversion'
    ? { mode: 'conversion', direction: studySet.conversion_direction }
    : { mode: 'meaning', visibility: studySet.meaning_visibility }
}
```

- [ ] **Step 2: Render the picker and persist changes**

In the `StudySetPage` component body, replace the existing "Start
studying" `Button` block:

```tsx
<Button asChild={cardCount > 0} size="lg" disabled={cardCount === 0} className="h-10">
  {cardCount > 0 ? (
    <Link to={`/sets/${setId}/study`}>
      <Play data-icon="inline-start" />
      Start studying
    </Link>
  ) : (
    <>
      <Play data-icon="inline-start" />
      Start studying
    </>
  )}
</Button>
{cardCount === 0 && (
  <p className="text-muted-foreground text-xs sm:text-right">
    Add a card to start studying.
  </p>
)}
```

with:

```tsx
{cardCount === 0 ? (
  <>
    <Button size="lg" disabled className="h-10">
      <Play data-icon="inline-start" />
      Start studying
    </Button>
    <p className="text-muted-foreground text-xs sm:text-right">
      Add a card to start studying.
    </p>
  </>
) : (
  <StudyModePicker
    config={configFromStudySet(studySet)}
    onChange={(config) => {
      saveStatus.setSaving()
      const patch =
        config.mode === 'conversion'
          ? { study_mode: 'conversion' as const, conversion_direction: config.direction }
          : { study_mode: 'meaning' as const, meaning_visibility: config.visibility }
      patchStudySet.mutate(patch, {
        onSuccess: saveStatus.setSaved,
        onError: () => saveStatus.setError(() => patchStudySet.mutate(patch)),
      })
    }}
    eligibleCount={eligibleCards(cards ?? [], configFromStudySet(studySet)).length}
    totalCount={cardCount}
    onStart={() => navigate(`/sets/${setId}/study`)}
  />
)}
```

Add the import: `import { StudyModePicker } from './StudyModePicker'`.
`navigate` is already destructured from `useNavigate()` earlier in
this component (used by `DeleteStudySetDialog`'s `onDeleted`), so no
new hook call is needed. `Play` and `Button` are already imported.

- [ ] **Step 3: Pass `config` down through `CardsSection`**

In `src/features/study-sets/CardsSection.tsx`, add the prop and thread
it to `EditableCardTile`:

```tsx
import type { StudyConfig } from '@/features/study/studyMode'
```

```tsx
export function CardsSection({
  studySetId,
  ownerId,
  config,
  onSaving,
  onSaved,
  onError,
}: {
  studySetId: string
  ownerId: string
  config: StudyConfig
  onSaving: () => void
  onSaved: () => void
  onError: (retry: () => void) => void
}) {
```

and in the `.map`:

```tsx
<EditableCardTile
  key={card.id}
  studySetId={studySetId}
  ownerId={ownerId}
  card={card}
  config={config}
  imageUrl={card.image_path ? imageUrls?.[card.image_path] : undefined}
  onSaving={onSaving}
  onSaved={onSaved}
  onError={onError}
/>
```

- [ ] **Step 4: Pass `config` from `StudySetPage` into `CardsSection`**

In `StudySetPage.tsx`, update the existing `<CardsSection>` call:

```tsx
{user && (
  <CardsSection
    studySetId={studySet.id}
    ownerId={user.id}
    config={configFromStudySet(studySet)}
    onSaving={saveStatus.setSaving}
    onSaved={saveStatus.setSaved}
    onError={saveStatus.setError}
  />
)}
```

- [ ] **Step 5: Lint and typecheck**

Run: `bun run lint && bun run build`
Expected: `EditableCardTile` will now fail to type-check because it
doesn't yet accept a `config` prop — that's expected and resolved in
Task 6. Confirm no *other* new errors appear (in particular,
`StudySetPage.tsx` and `CardsSection.tsx` themselves should be clean).

- [ ] **Step 6: Commit**

```bash
git add src/features/study-sets/StudySetPage.tsx src/features/study-sets/CardsSection.tsx
git commit -m "feat: wire StudyModePicker into the study set page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Per-card exclusion badges

**Files:**
- Modify: `src/features/study-sets/CardTile.tsx`
- Modify: `src/features/study-sets/EditableCardTile.tsx`

**Interfaces:**
- Consumes: `exclusionReason` (Task 2, `studyMode.ts`); `StudyConfig`
  (Task 2); `CardTileProps` (existing, this task extends it).
- Produces: `CardTileProps` gains `excludedReason?: string | null`;
  `EditableCardTile` accepts `config: StudyConfig` (added by Task 5's
  call site in `CardsSection.tsx`) and derives the badge.

- [ ] **Step 1: Add the badge to `CardTile.tsx`**

Add `EyeOff` to the existing `lucide-react` import line and add
`excludedReason` to `CardTileProps`:

```tsx
import { BadgeQuestionMark, BookOpen, EyeOff, ImageIcon, Languages, X } from 'lucide-react'
```

```tsx
export type CardTileProps = {
  imageUrl?: string
  onPickImage: (file: File) => void
  onRemoveImage?: () => void
  canRemoveImage?: boolean
  spanishTerm: string
  onSaveSpanishTerm: (value: string) => void
  autoFocusSpanishTerm?: boolean
  englishEquivalent: string
  onSaveEnglishEquivalent: (value: string) => void
  definition: string
  onSaveDefinition: (value: string) => void
  hint: string
  onSaveHint: (value: string) => void
  cornerSlot?: React.ReactNode
  footer?: React.ReactNode
  excludedReason?: string | null
}
```

Destructure it in the function signature (add `excludedReason` to the
existing destructured props), then render it as a banner strip above
the image, adjusting the image container's rounding so only one of the
two owns the tile's top corners:

```tsx
export function CardTile({
  imageUrl,
  onPickImage,
  onRemoveImage,
  canRemoveImage = false,
  spanishTerm,
  onSaveSpanishTerm,
  autoFocusSpanishTerm = false,
  englishEquivalent,
  onSaveEnglishEquivalent,
  definition,
  onSaveDefinition,
  hint,
  onSaveHint,
  cornerSlot,
  footer,
  excludedReason,
}: CardTileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="ring-foreground/10 group relative flex flex-col rounded-xl ring-1">
      {excludedReason && (
        <div className="bg-muted text-muted-foreground flex items-center gap-1.5 rounded-t-xl px-3 py-1.5 text-xs">
          <EyeOff className="size-3.5 shrink-0" />
          {excludedReason} — excluded from this study mode
        </div>
      )}
      <div
        className={cn(
          'group/image bg-muted/50 relative aspect-[4/3] w-full overflow-hidden',
          excludedReason ? 'rounded-none' : 'rounded-t-xl',
        )}
      >
```

This requires importing `cn`: add
`import { cn } from '@/lib/utils'` to the top of the file (check the
existing import block in `CardTile.tsx` — it currently has no `cn`
import, so add this as a new line grouped with the other `@/`
imports).

- [ ] **Step 2: Compute and pass the reason in `EditableCardTile.tsx`**

Update the props type and destructuring to accept `config`:

```tsx
import type { StudyConfig } from '@/features/study/studyMode'
import { exclusionReason } from '@/features/study/studyMode'
```

```tsx
export function EditableCardTile({
  studySetId,
  ownerId,
  card,
  config,
  imageUrl,
  onSaving,
  onSaved,
  onError,
}: {
  studySetId: string
  ownerId: string
  card: Card
  config: StudyConfig
  imageUrl?: string
  onSaving: () => void
  onSaved: () => void
  onError: (retry: () => void) => void
}) {
```

and pass it through to `CardTile` in the existing return statement, by
adding one prop:

```tsx
<CardTile
  imageUrl={imageUrl}
  onPickImage={replaceImage}
  onRemoveImage={removeImage}
  canRemoveImage={Boolean(card.image_path && card.definition)}
  spanishTerm={card.spanish_term}
  onSaveSpanishTerm={(spanish_term) => save({ spanish_term })}
  englishEquivalent={card.english_equivalent ?? ''}
  onSaveEnglishEquivalent={(english_equivalent) => save({ english_equivalent })}
  definition={card.definition ?? ''}
  onSaveDefinition={(definition) => save({ definition })}
  hint={card.hint ?? ''}
  onSaveHint={(hint) => save({ hint })}
  excludedReason={exclusionReason(card, config)}
  cornerSlot={
    ...unchanged...
  }
/>
```

(Leave the existing `cornerSlot` block exactly as-is — only the new
`excludedReason` line and the `config` prop threading are additions.)

- [ ] **Step 3: Lint and typecheck**

Run: `bun run lint && bun run build`
Expected: both succeed. This closes out the `CardsSection` →
`EditableCardTile` chain started in Task 5 — confirm no leftover
type errors reference `EditableCardTile` or `CardTile`.

- [ ] **Step 4: Commit**

```bash
git add src/features/study-sets/CardTile.tsx src/features/study-sets/EditableCardTile.tsx
git commit -m "feat: show per-card exclusion badge for the active study mode

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `study_sessions` API + hooks; `quizAttempts` API update

**Files:**
- Create: `src/api/studySessions.ts`
- Create: `src/features/study/hooks/useStudySessions.ts`
- Modify: `src/api/quizAttempts.ts` (no functional change needed —
  verify only; see Step 3)

**Interfaces:**
- Consumes: `supabase` (`src/lib/supabase.ts`); `StudySession`,
  `StudySessionInput` (Task 1, `src/types/studySession.ts`).
- Produces (used by Task 8):
  ```ts
  // src/api/studySessions.ts
  export async function createStudySession(input: StudySessionInput): Promise<StudySession>
  export async function completeStudySession(
    id: string,
    patch: { completed_at: string; cards_answered: number },
  ): Promise<StudySession>

  // src/features/study/hooks/useStudySessions.ts
  export function useStartStudySession(): UseMutationResult<StudySession, Error, StudySessionInput>
  export function useCompleteStudySession(): UseMutationResult<
    StudySession,
    Error,
    { id: string; cardsAnswered: number }
  >
  ```

- [ ] **Step 1: Create `src/api/studySessions.ts`**

```ts
import { supabase } from '@/lib/supabase'
import type { StudySession, StudySessionInput } from '@/types/studySession'

export async function createStudySession(input: StudySessionInput): Promise<StudySession> {
  const { data, error } = await supabase
    .from('study_sessions')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function completeStudySession(
  id: string,
  patch: { completed_at: string; cards_answered: number },
): Promise<StudySession> {
  const { data, error } = await supabase
    .from('study_sessions')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}
```

- [ ] **Step 2: Create `src/features/study/hooks/useStudySessions.ts`**

```ts
import { useMutation } from '@tanstack/react-query'
import { completeStudySession, createStudySession } from '@/api/studySessions'

/**
 * Opens a study_sessions row at the start of a session. Fire during
 * mount, before any attempts are logged, so attempts can carry the
 * resulting session_id.
 */
export function useStartStudySession() {
  return useMutation({
    mutationFn: createStudySession,
  })
}

/**
 * Closes a study_sessions row once the deck is exhausted. Fire-and-
 * forget from the caller's perspective, like useLogQuizAttempt -- a
 * failed completion write shouldn't block showing the "Nice work!"
 * screen.
 */
export function useCompleteStudySession() {
  return useMutation({
    mutationFn: ({ id, cardsAnswered }: { id: string; cardsAnswered: number }) =>
      completeStudySession(id, { completed_at: new Date().toISOString(), cards_answered: cardsAnswered }),
    onError: (error) => {
      console.error('Failed to mark study session complete:', error)
    },
  })
}
```

- [ ] **Step 3: Verify `src/api/quizAttempts.ts` needs no change**

Read `src/api/quizAttempts.ts` — it calls
`supabase.from('quiz_attempts').insert(input)` with `input:
QuizAttemptInput`. Since Task 1 already widened `QuizAttemptInput` to
include `session_id`/`resolved_direction`, this file's implementation
is already correct as-is (it passes `input` straight through). No
edit needed here; this step is a verification checkpoint, not a code
change.

- [ ] **Step 4: Lint and typecheck**

Run: `bun run lint && bun run build`
Expected: no new errors from these two new files (they are not
imported anywhere yet).

- [ ] **Step 5: Commit**

```bash
git add src/api/studySessions.ts src/features/study/hooks/useStudySessions.ts
git commit -m "feat: add study_sessions API and start/complete hooks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `StudySessionPage` — build questions once, log session lifecycle

**Files:**
- Modify: `src/features/study/StudySessionPage.tsx`

**Interfaces:**
- Consumes: `eligibleCards`, `buildQuestion`, `Question`, `StudyConfig`
  (Task 2); `useStartStudySession`, `useCompleteStudySession` (Task
  7); `useStudySet` (existing — already returns the full `StudySet`
  record including the new mode/setting columns from Task 1).
- Produces (used by Task 9): passes a single `question: Question`
  (instead of today's `card: Card`) into `QuizCard`, plus a new
  `sessionId: string | null` prop.

- [ ] **Step 1: Rewrite `StudySessionPage.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useCards } from '@/features/study-sets/hooks/useCards'
import { useSignedImageUrls } from '@/features/study-sets/hooks/useSignedImageUrls'
import { useStudySet } from '@/features/study-sets/hooks/useStudySets'
import { useImagePrefetch } from '@/hooks/useImagePrefetch'
import { eligibleCards, buildQuestion, type Question, type StudyConfig } from './studyMode'
import { useCompleteStudySession, useStartStudySession } from './hooks/useStudySessions'
import { QuizCard } from './QuizCard'
import type { StudySet } from '@/types/studySet'

function configFromStudySet(studySet: StudySet): StudyConfig {
  return studySet.study_mode === 'conversion'
    ? { mode: 'conversion', direction: studySet.conversion_direction }
    : { mode: 'meaning', visibility: studySet.meaning_visibility }
}

export function StudySessionPage() {
  const { setId } = useParams<{ setId: string }>()
  const { data: studySet } = useStudySet(setId)
  const { data: cards, isLoading, isError, error } = useCards(setId)
  const [index, setIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  // Built once per (cards, config) pair, not recomputed on every
  // render -- under conversion mode's 'random' direction, recomputing
  // would reshuffle a card's direction mid-session.
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const builtForRef = useRef<string | null>(null)

  const startSession = useStartStudySession()
  const completeSession = useCompleteStudySession()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionStartedRef = useRef(false)

  useEffect(() => {
    if (!cards || !studySet) return
    const config = configFromStudySet(studySet)
    const buildKey = `${studySet.id}:${studySet.study_mode}:${studySet.conversion_direction}:${studySet.meaning_visibility}:${cards.length}`
    if (builtForRef.current === buildKey) return
    builtForRef.current = buildKey

    const deck = eligibleCards(cards, config)
    setQuestions(deck.map((card) => buildQuestion(card, config)))
    setIndex(0)
    setCorrectCount(0)

    if (!sessionStartedRef.current && deck.length > 0) {
      sessionStartedRef.current = true
      startSession.mutate(
        {
          study_set_id: studySet.id,
          mode: config.mode,
          direction: config.mode === 'conversion' ? config.direction : null,
          visibility: config.mode === 'meaning' ? config.visibility : null,
          deck_size: deck.length,
        },
        { onSuccess: (session) => setSessionId(session.id) },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildKey captures every dependency that should retrigger this
  }, [cards, studySet])

  const imagePaths = useMemo(
    () => (questions ?? []).map((q) => q.card.image_path).filter((p): p is string => p != null),
    [questions],
  )
  const { data: imageUrls } = useSignedImageUrls(imagePaths)

  // Warm the browser's cache for every card in the deck as soon as their
  // signed URLs resolve, so advancing through the quiz doesn't wait on
  // each image's own fetch.
  useImagePrefetch(useMemo(() => Object.values(imageUrls ?? {}), [imageUrls]))

  if (!setId) {
    return <Navigate to="/" replace />
  }

  const currentQuestion = questions?.[index]
  const isComplete = !!questions && questions.length > 0 && index >= questions.length

  useEffect(() => {
    if (isComplete && sessionId) {
      completeSession.mutate({ id: sessionId, cardsAnswered: correctCount })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when isComplete flips true
  }, [isComplete])

  function restart() {
    if (!cards || !studySet) return
    const config = configFromStudySet(studySet)
    const deck = eligibleCards(cards, config)
    setQuestions(deck.map((card) => buildQuestion(card, config)))
    setIndex(0)
    setCorrectCount(0)
    sessionStartedRef.current = true
    setSessionId(null)
    startSession.mutate(
      {
        study_set_id: studySet.id,
        mode: config.mode,
        direction: config.mode === 'conversion' ? config.direction : null,
        visibility: config.mode === 'meaning' ? config.visibility : null,
        deck_size: deck.length,
      },
      { onSuccess: (session) => setSessionId(session.id) },
    )
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-4">
      <Link to="/" className="text-muted-foreground text-sm underline underline-offset-4">
        ← Back to study sets
      </Link>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {isError && (
        <p className="text-destructive text-sm">Failed to load cards: {(error as Error).message}</p>
      )}

      {questions && questions.length === 0 && (
        <p className="text-muted-foreground">
          No cards are eligible for this set's current study mode.{' '}
          <Link to={`/sets/${setId}`} className="underline underline-offset-4">
            Change the mode or add cards
          </Link>
          .
        </p>
      )}

      {currentQuestion && (
        <>
          <p className="text-muted-foreground text-sm">
            Card {index + 1} of {questions!.length}
          </p>
          <QuizCard
            key={currentQuestion.card.id}
            question={currentQuestion}
            imageUrl={
              currentQuestion.card.image_path
                ? imageUrls?.[currentQuestion.card.image_path]
                : undefined
            }
            sessionId={sessionId}
            onCorrect={() => setCorrectCount((c) => c + 1)}
            onNext={() => setIndex((i) => i + 1)}
          />
        </>
      )}

      {isComplete && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <h1 className="text-xl font-semibold">Nice work!</h1>
          <p className="text-muted-foreground">
            You've gone through all {questions!.length} cards in "{studySet?.title}".
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={restart}>
              Study again
            </Button>
            <Button asChild>
              <Link to={`/sets/${setId}`}>Back to the set</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Lint and typecheck**

Run: `bun run lint && bun run build`
Expected: `QuizCard.tsx` still fails to type-check at this point
(it doesn't yet accept `question`/`sessionId`/`onCorrect` props) —
expected, resolved in Task 9. Confirm no other new errors in
`StudySessionPage.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add src/features/study/StudySessionPage.tsx
git commit -m "feat: build the question deck from study config, log session lifecycle

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `QuizCard` — render `Question`, hide accent pad for English answers, log mode context

**Files:**
- Modify: `src/features/study/QuizCard.tsx`

**Interfaces:**
- Consumes: `Question` (Task 2, `studyMode.ts`); `isAnswerCorrect`
  (existing, unchanged, `src/lib/grading.ts`); `useLogQuizAttempt`
  (existing, `src/features/study/hooks/useLogQuizAttempt.ts`).
- Produces: `QuizCard` component signature becomes
  `{ question: Question; imageUrl: string | undefined; sessionId:
  string | null; onCorrect: () => void; onNext: () => void }` — this
  is the final consumer of `Question`/`sessionId` introduced by Task 8.

- [ ] **Step 1: Rewrite `QuizCard.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { AccentedCharPad } from '@/components/AccentedCharPad'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCursorInsert } from '@/hooks/useCursorInsert'
import { isAnswerCorrect } from '@/lib/grading'
import type { Question } from './studyMode'
import { useLogQuizAttempt } from './hooks/useLogQuizAttempt'

const MAX_ATTEMPTS = 3

type Feedback = 'correct' | 'retry' | 'revealed' | null

/**
 * One quiz question: prompt (conversion mode's word, or meaning mode's
 * image/definition) + a typed-answer input, with immediate right/wrong
 * feedback. Mount fresh per card (parent keys it by card.id) so all
 * local state resets between cards automatically.
 *
 * A wrong answer gets up to MAX_ATTEMPTS tries before revealing the
 * correct answer -- only a correct answer or the final wrong attempt
 * locks the input and advances to "Next".
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
  const [value, setValue] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [hintShown, setHintShown] = useState(false)

  const cursor = useCursorInsert(() => value, setValue)
  const locked = feedback === 'correct' || feedback === 'revealed'
  const logAttempt = useLogQuizAttempt()

  function logResult(isCorrect: boolean, attemptCount: number) {
    logAttempt.mutate({
      card_id: card.id,
      is_correct: isCorrect,
      attempt_count: attemptCount,
      session_id: sessionId,
      resolved_direction: question.resolvedDirection,
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (locked) {
      onNext()
      return
    }

    if (isAnswerCorrect(value, question.expectedAnswer)) {
      setFeedback('correct')
      logResult(true, attempts + 1)
      onCorrect()
      return
    }

    const nextAttempts = attempts + 1
    setAttempts(nextAttempts)
    if (nextAttempts >= MAX_ATTEMPTS) {
      setFeedback('revealed')
      logResult(false, nextAttempts)
    } else {
      setFeedback('retry')
      setValue('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quiz-answer">Your answer</Label>
        {question.answerLanguage === 'es' && (
          <AccentedCharPad onInsert={locked ? () => {} : cursor.insert} />
        )}
        <Input
          id="quiz-answer"
          autoComplete="off"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          readOnly={locked}
          className={locked ? 'text-muted-foreground' : undefined}
          ref={(el) => cursor.setRef(el)}
        />
      </div>

      {feedback === 'correct' && (
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Correct!</p>
      )}
      {feedback === 'retry' && (
        <p className="text-destructive text-sm font-medium">
          Not quite. {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts === 1 ? '' : 's'}{' '}
          left.
        </p>
      )}
      {feedback === 'revealed' && (
        <p className="text-destructive text-sm font-medium">
          Not quite. The answer was: {question.expectedAnswer}
        </p>
      )}

      <Button type="submit">{locked ? 'Next' : 'Check'}</Button>
    </form>
  )
}
```

Note the conversion-mode prompt path: when neither `showImage` nor
`showDefinition` is set (conversion mode), the word prompt renders in
a bordered box in place of the image/definition area — keeping the
same visual rhythm (bordered content area → hint → answer input) as
meaning mode, per the settled "just the word" design decision.

- [ ] **Step 2: Run the full test suite**

Run: `bun test`
Expected: PASS — `studyMode.test.ts` and `grading.test.ts` both green.

- [ ] **Step 3: Lint and full build**

Run: `bun run lint && bun run build`
Expected: both succeed with zero errors. This is the point where every
type error introduced across Tasks 1, 5, 6, 8 (all of which depended
on this task's `QuizCard` rewrite) should now be resolved — if
`bun run build` still fails anywhere, find and fix the remaining call
site before proceeding.

- [ ] **Step 4: Commit**

```bash
git add src/features/study/QuizCard.tsx
git commit -m "feat: render QuizCard from Question, log session/direction on attempts

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Manual verification (left to the user)

Once all 9 tasks are complete, the following need a live Supabase
project and are **not** automated by this plan:

- Apply `0006_study_modes.sql` to the target Supabase project.
- Confirm existing study sets default to `meaning`/`both` and study
  exactly as before.
- Exercise the picker: switch modes/settings on the set page, confirm
  the save-status indicator and exclusion badges update correctly,
  including the empty-deck ("both" visibility with no fully-qualifying
  cards) case.
- Run a full conversion-mode session under each direction (including
  `random` across enough cards to see both directions occur) and a
  full meaning-mode session under each visibility setting; confirm the
  accent pad is hidden exactly when the expected answer is English.
- Inspect the `study_sessions` and `quiz_attempts` rows written by a
  real session (via the Supabase dashboard or a `select`) to confirm
  `mode`/`direction`/`visibility`/`session_id`/`resolved_direction`
  land as expected, and that `completed_at`/`cards_answered` are
  stamped when a session finishes.
