# DR-11 Core API Changes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Supabase data-access functions into `@escritorio/core` behind `createApi(supabase)`, make study-session and quiz-attempt creates safe to retry (client ids and timestamps, `ON CONFLICT DO NOTHING`), and make image uploads take `Blob | ArrayBuffer` plus a content type. The web app switches to `createApi` with no change in behaviour.

**Architecture:** Each API module in `packages/core/src/api/` exports a `create<Name>Api(supabase)` factory. `createApi` composes them into one object (`api.studySets.listStudySets()`, and so on). Core tests use a real `supabase-js` client with an injected fake `fetch`, so they assert on the actual HTTP requests. One opt-in integration test runs against the local Supabase stack to prove the RLS behaviour of the new upserts. The web app builds its own client and calls `createApi` once, in `apps/web/src/lib/api.ts`.

**Tech Stack:** Bun workspaces, TypeScript 6, Vitest 5, `@supabase/supabase-js` 2.116, local Supabase stack (Docker), TanStack Query (web hooks).

**Spec:** `docs/superpowers/specs/2026-10-13-ios-app-design.md` (sections "Client-injected API", "Write path (device → server): outbox", "Testing", rollout step 2)

**Stacking:** This branch (`feat/dr-11-ios-26-core-api-changes-client-injection-offline-safe`) is stacked on `feat/dr-10-…` (PR #25) using `gh stack`. Publish with `gh stack submit`, not `gh pr create`.

## Global Constraints

- Core has no React, no DOM and no React Native imports. Pure TypeScript plus `@supabase/supabase-js` types and `zod`.
- Core's internal imports are relative (no `@/` alias).
- `createApi(supabase)` returns `{ studySets, cards, cardImages, studySetImages, quizAttempts, studySessions }`.
- `createQuizAttempt` accepts optional `id` and `answered_at`, and inserts with `upsert(..., { onConflict: 'id', ignoreDuplicates: true })`.
- `createStudySession` accepts optional `id` and `started_at`, with the same insert behaviour.
- `uploadCardImage` / `uploadStudySetImage` accept `Blob | ArrayBuffer` plus a content type instead of a DOM `File`.
- Web hooks stay in web. They are unchanged apart from imports and call sites.
- The web app's behaviour must not change.
- If `ON CONFLICT DO NOTHING` upserts fail under the current RLS policies, fall back to a plain insert and treat error `23505` as success.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **RLS on the new upserts.** `quiz_attempts` has no update policy. `INSERT … ON CONFLICT DO NOTHING` must succeed for the owner, and sending the same row twice must leave exactly one row. Pinned by the integration test in Task 2.
2. **Web sends without an id.** Web never passes `id`, so every web send must still create a new row; retry-dedupe must not swallow distinct attempts. Pinned by the integration test in Task 2: two web-style sends give 2 rows.
3. **Retried `createStudySession` returns `null`.** A duplicate send returns no row. The function must resolve to `null` instead of throwing PGRST116, and the web caller must not crash on `null`. Pinned by the Task 2 unit test and the `StudySessionPage` guard.
4. **Lineage-trigger errors stay distinguishable.** An attempt for a deleted card must reject with an error carrying its Postgres `code` (`P0001`). DR-15's outbox will treat it as "couldn't sync" rather than a network error. Pinned by the integration test in Task 2.
5. **Upload content type.** A web `File` must keep its own MIME type (multipart path). An `ArrayBuffer` must send the given `content-type` header, or images would be served as `application/octet-stream`. Pinned by the Task 3 unit tests.

---

### Task 1: `createApi` in core; web switches to it

Pure move plus client injection. No behaviour change.

**Files:**
- Modify: `packages/core/package.json` (add `@supabase/supabase-js`)
- Create: `packages/core/src/api/testing/fakeSupabase.ts`
- Create: `packages/core/src/api/storage.ts`
- Move (`git mv`): `apps/web/src/api/signedUrlBatcher.ts` and `.test.ts` → `packages/core/src/api/`
- Create: `packages/core/src/api/{studySets,cards,cardImages,studySetImages,quizAttempts,studySessions,index}.ts`
- Create: `packages/core/src/api/api.test.ts`
- Modify: `packages/core/src/index.ts`, `packages/core/src/index.test.ts`
- Create: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/features/study-sets/hooks/{useStudySets,useCards,useSignedImageUrls}.ts`, `apps/web/src/features/study/hooks/{useStudySessions,useLogQuizAttempt}.ts`
- Delete: `apps/web/src/api/{studySets,cards,cardImages,studySetImages,quizAttempts,studySessions}.ts`. Keep `apps/web/src/api/idioms.ts`, which is web-only.

**Interfaces:**
- Produces:
  - `createApi(supabase: SupabaseClient): Api`
  - `type Api = ReturnType<typeof createApi>`
  - `cardImagePath(ownerId, cardId, filename): string`
  - `studySetImagePath(ownerId, studySetId, filename): string`
  - `SIGNED_URL_STALE_TIME_MS: number`
  - `fakeSupabase(respond?)` returns `{ client: SupabaseClient, requests: RecordedRequest[] }` (test-only, not exported from the barrel)
- `api.<module>.<fn>` keeps the exact names and signatures of today's `apps/web/src/api/*` functions.

- [ ] **Step 1: Add the dependency**

In `packages/core/package.json` `dependencies`, add `"@supabase/supabase-js": "^2.116.0"` (the same range as `apps/web`, so Bun keeps a single copy and the `SupabaseClient` types are identical). Run `bun install`.

Expected: lockfile updated; `ls node_modules/.bun | grep supabase-js` still shows only `@supabase+supabase-js@2.116.0`.

- [ ] **Step 2: Write the fake client**

`packages/core/src/api/testing/fakeSupabase.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const FAKE_SUPABASE_URL = 'http://supabase.test'

export interface RecordedRequest {
  method: string
  url: URL
  headers: Headers
  // Parsed JSON when the body is JSON, the raw text otherwise.
  body: unknown
}

export interface FakeResponse {
  status?: number
  body?: unknown
}

/**
 * A real supabase-js client whose network calls go to `respond` instead
 * of a server, so tests assert on the HTTP requests the API actually
 * makes (paths, query params, Prefer headers, bodies).
 */
export function fakeSupabase(respond: (request: RecordedRequest) => FakeResponse = () => ({})) {
  const requests: RecordedRequest[] = []

  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    const text = await request.text()
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : undefined
    } catch {
      // Not JSON (e.g. a multipart upload): keep the raw text.
    }
    const recorded: RecordedRequest = {
      method: request.method,
      url: new URL(request.url),
      headers: request.headers,
      body,
    }
    requests.push(recorded)

    const { status = 200, body: responseBody = [] } = respond(recorded)
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }

  const client: SupabaseClient = createClient(FAKE_SUPABASE_URL, 'anon-key', {
    global: { fetch: fakeFetch },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { client, requests }
}
```

- [ ] **Step 3: Write the failing tests**

`packages/core/src/api/api.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createApi } from './index'
import { fakeSupabase } from './testing/fakeSupabase'

describe('createApi', () => {
  it('exposes one namespace per table/bucket', () => {
    const api = createApi(fakeSupabase().client)
    expect(Object.keys(api).sort()).toEqual([
      'cardImages',
      'cards',
      'quizAttempts',
      'studySessions',
      'studySetImages',
      'studySets',
    ])
  })

  it('sends queries through the injected client', async () => {
    const card = { id: 'c1', study_set_id: 's1', position: 0 }
    const { client, requests } = fakeSupabase(() => ({ body: [card] }))

    const cards = await createApi(client).cards.listCards('s1')

    expect(cards).toEqual([card])
    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe('GET')
    expect(requests[0].url.pathname).toBe('/rest/v1/cards')
    expect(requests[0].url.searchParams.get('study_set_id')).toBe('eq.s1')
    expect(requests[0].url.searchParams.get('order')).toBe('position.asc')
  })

  it('flattens embedded card image paths into fallback_image_paths', async () => {
    const { client } = fakeSupabase(() => ({
      body: [{ id: 's1', title: 'Set', cards: [{ image_path: 'u/a.webp' }, { image_path: null }] }],
    }))

    const sets = await createApi(client).studySets.listStudySets()

    expect(sets).toEqual([{ id: 's1', title: 'Set', fallback_image_paths: ['u/a.webp'] }])
  })

  it('throws the Supabase error when a request fails', async () => {
    const { client } = fakeSupabase(() => ({
      status: 400,
      body: { code: '22P02', message: 'invalid input syntax for type uuid' },
    }))

    await expect(createApi(client).cards.listCards('nope')).rejects.toMatchObject({
      code: '22P02',
    })
  })

  it('batches signed-URL requests made in the same tick', async () => {
    const { client, requests } = fakeSupabase(() => ({
      body: [
        { path: 'u/a.webp', signedURL: '/object/sign/flashcard-images/u/a.webp?token=a' },
        { path: 'u/b.webp', signedURL: '/object/sign/flashcard-images/u/b.webp?token=b' },
      ],
    }))
    const api = createApi(client)

    const [a, b] = await Promise.all([
      api.cardImages.getSignedImageUrl('u/a.webp'),
      api.cardImages.getSignedImageUrl('u/b.webp'),
    ])

    expect(requests).toHaveLength(1)
    expect(requests[0].url.pathname).toBe('/storage/v1/object/sign/flashcard-images')
    expect(a).toContain('token=a')
    expect(b).toContain('token=b')
  })
})
```

In `packages/core/src/index.test.ts`, add these names to the `it.each` list after `'authSchema'`: `'createApi'`, `'cardImagePath'`, `'studySetImagePath'`, `'SIGNED_URL_STALE_TIME_MS'`.

- [ ] **Step 4: Run them to verify they fail**

Run: `bun run --filter @escritorio/core test`
Expected: FAIL. `api.test.ts` fails to resolve `./index` in `src/api`, and the barrel test fails the 4 new names.

- [ ] **Step 5: Move the batcher and write the API modules**

```bash
git mv apps/web/src/api/signedUrlBatcher.ts packages/core/src/api/signedUrlBatcher.ts
git mv apps/web/src/api/signedUrlBatcher.test.ts packages/core/src/api/signedUrlBatcher.test.ts
```

(Their imports are already relative, so no edits are needed.)

`packages/core/src/api/storage.ts`:

```ts
// Card and study set images share one bucket (and its owner-scoped RLS
// policies). Study set images are nested under `sets/` so their paths can
// never collide with a card's.
export const IMAGE_BUCKET = 'flashcard-images'

export function extensionOf(filename: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename)
  return match ? match[1].toLowerCase() : 'bin'
}
```

`packages/core/src/api/studySets.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StudySet, StudySetInput, StudySetSummary } from '../types/studySet'

const FALLBACK_IMAGE_COUNT = 3

export function createStudySetsApi(supabase: SupabaseClient) {
  // Embeds the first few card image paths (by position) with each set, so the
  // dashboard can build thumbnail fallbacks without one extra query per set.
  async function listStudySets(): Promise<StudySetSummary[]> {
    const { data, error } = await supabase
      .from('study_sets')
      .select('*, cards(image_path)')
      .not('cards.image_path', 'is', null)
      .order('updated_at', { ascending: false })
      .order('position', { referencedTable: 'cards', ascending: true })
      .limit(FALLBACK_IMAGE_COUNT, { referencedTable: 'cards' })
      .returns<(StudySet & { cards: { image_path: string | null }[] })[]>()
    if (error) throw error
    return data.map(({ cards, ...studySet }) => ({
      ...studySet,
      fallback_image_paths: cards
        .map((card) => card.image_path)
        .filter((p): p is string => p != null),
    }))
  }

  async function getStudySet(id: string): Promise<StudySet> {
    const { data, error } = await supabase.from('study_sets').select('*').eq('id', id).single()
    if (error) throw error
    return data
  }

  async function createStudySet(ownerId: string, input: StudySetInput): Promise<StudySet> {
    const { data, error } = await supabase
      .from('study_sets')
      .insert({ ...input, owner_id: ownerId })
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  async function updateStudySet(id: string, input: Partial<StudySetInput>): Promise<StudySet> {
    const { data, error } = await supabase
      .from('study_sets')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  async function deleteStudySet(id: string): Promise<void> {
    const { error } = await supabase.from('study_sets').delete().eq('id', id)
    if (error) throw error
  }

  return { listStudySets, getStudySet, createStudySet, updateStudySet, deleteStudySet }
}
```

`packages/core/src/api/cards.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Card, CardInput } from '../types/card'

export function createCardsApi(supabase: SupabaseClient) {
  async function listCards(studySetId: string): Promise<Card[]> {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('study_set_id', studySetId)
      .order('position', { ascending: true })
    if (error) throw error
    return data
  }

  async function createCard(id: string, studySetId: string, input: CardInput): Promise<Card> {
    const { data, error } = await supabase
      .from('cards')
      .insert({ id, study_set_id: studySetId, ...input })
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  async function updateCard(id: string, input: Partial<CardInput>): Promise<Card> {
    const { data, error } = await supabase
      .from('cards')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  async function deleteCard(id: string): Promise<void> {
    const { error } = await supabase.from('cards').delete().eq('id', id)
    if (error) throw error
  }

  return { listCards, createCard, updateCard, deleteCard }
}
```

`packages/core/src/api/cardImages.ts` (the upload signature is unchanged here; Task 3 changes it). The `File` type is not available without DOM libs, so for now type the body as `Blob`, which `File` extends:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSignedUrlBatcher } from './signedUrlBatcher'
import { extensionOf, IMAGE_BUCKET } from './storage'

// Signed URLs are valid for an hour; React Query's staleTime is set below
// that (see useSignedImageUrls) so a fresh URL is fetched before the old
// one expires during a long session.
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60

export const SIGNED_URL_STALE_TIME_MS = (SIGNED_URL_EXPIRES_IN_SECONDS - 10 * 60) * 1000

export function cardImagePath(ownerId: string, cardId: string, filename: string): string {
  return `${ownerId}/${cardId}.${extensionOf(filename)}`
}

export function createCardImagesApi(supabase: SupabaseClient) {
  async function uploadCardImage(
    path: string,
    file: Blob,
    { upsert = false }: { upsert?: boolean } = {},
  ): Promise<void> {
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { upsert })
    if (error) throw error
  }

  async function deleteCardImages(paths: string[]): Promise<void> {
    if (paths.length === 0) return
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths)
    if (error) throw error
  }

  async function getSignedImageUrls(paths: string[]): Promise<Record<string, string>> {
    if (paths.length === 0) return {}
    const { data, error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_EXPIRES_IN_SECONDS)
    if (error) throw error

    const map: Record<string, string> = {}
    data.forEach((entry, i) => {
      if (entry.signedUrl) map[paths[i]] = entry.signedUrl
    })
    return map
  }

  return {
    uploadCardImage,
    deleteCardImages,
    getSignedImageUrls,
    // One signed URL per path, batched with any others requested in the same
    // tick (see useSignedImageUrls). Null when the object has no signed URL.
    // One batcher per client, so batching works as long as each app calls
    // createApi once.
    getSignedImageUrl: createSignedUrlBatcher(getSignedImageUrls),
  }
}
```

`packages/core/src/api/studySetImages.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { extensionOf, IMAGE_BUCKET } from './storage'

export function studySetImagePath(ownerId: string, studySetId: string, filename: string): string {
  return `${ownerId}/sets/${studySetId}.${extensionOf(filename)}`
}

export function createStudySetImagesApi(supabase: SupabaseClient) {
  async function uploadStudySetImage(
    path: string,
    file: Blob,
    { upsert = false }: { upsert?: boolean } = {},
  ): Promise<void> {
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { upsert })
    if (error) throw error
  }

  async function deleteStudySetImages(paths: string[]): Promise<void> {
    if (paths.length === 0) return
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths)
    if (error) throw error
  }

  return { uploadStudySetImage, deleteStudySetImages }
}
```

`packages/core/src/api/quizAttempts.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { QuizAttemptInput } from '../types/quizAttempt'

export function createQuizAttemptsApi(supabase: SupabaseClient) {
  async function createQuizAttempt(input: QuizAttemptInput): Promise<void> {
    const { error } = await supabase.from('quiz_attempts').insert(input)
    if (error) throw error
  }

  return { createQuizAttempt }
}
```

`packages/core/src/api/studySessions.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { StudySession, StudySessionInput } from '../types/studySession'

export function createStudySessionsApi(supabase: SupabaseClient) {
  async function createStudySession(input: StudySessionInput): Promise<StudySession> {
    const { data, error } = await supabase
      .from('study_sessions')
      .insert(input)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  async function completeStudySession(
    id: string,
    patch: { completed_at: string; cards_correct: number },
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

  return { createStudySession, completeStudySession }
}
```

`packages/core/src/api/index.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { createCardImagesApi } from './cardImages'
import { createCardsApi } from './cards'
import { createQuizAttemptsApi } from './quizAttempts'
import { createStudySessionsApi } from './studySessions'
import { createStudySetImagesApi } from './studySetImages'
import { createStudySetsApi } from './studySets'

/**
 * Every Supabase read and write the apps make, bound to one client. Each
 * app builds its own client (web: localStorage session; mobile: encrypted
 * storage) and calls this once.
 */
export function createApi(supabase: SupabaseClient) {
  return {
    studySets: createStudySetsApi(supabase),
    cards: createCardsApi(supabase),
    cardImages: createCardImagesApi(supabase),
    studySetImages: createStudySetImagesApi(supabase),
    quizAttempts: createQuizAttemptsApi(supabase),
    studySessions: createStudySessionsApi(supabase),
  }
}

export type Api = ReturnType<typeof createApi>
```

Append to `packages/core/src/index.ts`:

```ts
export { createApi, type Api } from './api'
export { cardImagePath, SIGNED_URL_STALE_TIME_MS } from './api/cardImages'
export { studySetImagePath } from './api/studySetImages'
```

- [ ] **Step 6: Run core tests and typecheck**

Run: `bun run --filter @escritorio/core test && bun run --filter @escritorio/core typecheck`
Expected: PASS. All of `api.test.ts` passes, the moved batcher tests pass, the barrel test passes with 23 names, and typecheck is clean with no DOM lib. If the signed-URL test's response shape doesn't match what storage-js 2.116 parses (`signedURL` vs `signedUrl`), read `createSignedUrls` in `node_modules/.bun/@supabase+storage-js@2.116.0/.../dist/index.mjs` and fix **the fake response in the test**, not the API.

- [ ] **Step 7: Switch the web app**

`apps/web/src/lib/api.ts`:

```ts
import { createApi } from '@escritorio/core'
import { supabase } from './supabase'

export const api = createApi(supabase)
```

Delete the moved web modules:

```bash
git rm apps/web/src/api/studySets.ts apps/web/src/api/cards.ts apps/web/src/api/cardImages.ts \
  apps/web/src/api/studySetImages.ts apps/web/src/api/quizAttempts.ts apps/web/src/api/studySessions.ts
```

Rewrite imports and call sites. Each hook drops its `@/api/*` imports (except `@/api/idioms`) and adds `import { api } from '@/lib/api'`. The pure helpers come from core.

`useStudySets.ts`:
- Remove the imports from `@/api/cardImages`, `@/api/cards`, `@/api/studySets` and `@/api/studySetImages`.
- Add `import { api } from '@/lib/api'`.
- Add `studySetImagePath` to the existing `@escritorio/core` import.
- Rewrite the calls:

| Old | New |
| --- | --- |
| `queryFn: listStudySets` | `queryFn: api.studySets.listStudySets` |
| `getStudySet(` | `api.studySets.getStudySet(` |
| `createStudySet(` | `api.studySets.createStudySet(` |
| `updateStudySet(` | `api.studySets.updateStudySet(` |
| `deleteStudySet(` | `api.studySets.deleteStudySet(` |
| `listCards(` | `api.cards.listCards(` |
| `uploadStudySetImage(` | `api.studySetImages.uploadStudySetImage(` |
| `deleteStudySetImages(` | `api.studySetImages.deleteStudySetImages(` |
| `deleteCardImages(` | `api.cardImages.deleteCardImages(` |

`useCards.ts`:
- Remove the imports from `@/api/cardImages` and `@/api/cards`.
- Add `import { api } from '@/lib/api'`.
- Add `cardImagePath` to the `@escritorio/core` import.
- Rewrite the calls:

| Old | New |
| --- | --- |
| `listCards(` | `api.cards.listCards(` |
| `createCard(` | `api.cards.createCard(` |
| `updateCard(` | `api.cards.updateCard(` |
| `deleteCard(` | `api.cards.deleteCard(` |
| `uploadCardImage(` | `api.cardImages.uploadCardImage(` |
| `deleteCardImages(` | `api.cardImages.deleteCardImages(` |

`useSignedImageUrls.ts`:
- Replace `import { getSignedImageUrl, SIGNED_URL_STALE_TIME_MS } from '@/api/cardImages'` with `import { api } from '@/lib/api'`.
- Add `SIGNED_URL_STALE_TIME_MS` to the `@escritorio/core` import.
- `getSignedImageUrl(path)` becomes `api.cardImages.getSignedImageUrl(path)`.

`useStudySessions.ts`:
- Replace the `@/api/studySessions` import with `import { api } from '@/lib/api'`.
- `mutationFn: createStudySession` becomes `mutationFn: api.studySessions.createStudySession`.
- `completeStudySession(id, …)` becomes `api.studySessions.completeStudySession(id, …)`.

`useLogQuizAttempt.ts`:
- Replace the `@/api/quizAttempts` import with `import { api } from '@/lib/api'`.
- `mutationFn: createQuizAttempt` becomes `mutationFn: api.quizAttempts.createQuizAttempt`.

Watch the replacement order in `useStudySets.ts`: replace `deleteStudySetImages(` before `deleteStudySet(` so the shorter name doesn't clobber the longer one.

Then run: `grep -rn "@/api/" apps/web/src | grep -v "@/api/idioms"`
Expected: no output.

- [ ] **Step 8: Verify everything**

Run: `bun run typecheck && bun run test && bun run lint && bun run --filter @escritorio/web build`
Expected: typecheck clean; tests all pass (core 65 + new; web 40 − the 3 moved batcher tests); lint shows the same 3 pre-existing warnings; build succeeds.

Then run `bun run dev`, open the app, and confirm that the dashboard loads sets with thumbnails and that one set's cards load. Stop the server by its PID, never with `pkill -f vite`.

- [ ] **Step 9: Commit**

```bash
git add -A packages/core apps/web bun.lock
git commit -m "refactor: move Supabase API into core behind createApi(supabase)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Retry-safe study-session and quiz-attempt creates

**Files:**
- Modify: `packages/core/src/types/quizAttempt.ts`, `packages/core/src/types/studySession.ts`
- Modify: `packages/core/src/api/quizAttempts.ts`, `packages/core/src/api/studySessions.ts`
- Create: `packages/core/src/api/inserts.test.ts`
- Create: `packages/core/src/api/api.integration.test.ts`
- Modify: `packages/core/package.json` (add the `test:integration` script)
- Modify: `apps/web/src/features/study/StudySessionPage.tsx` (null guard)

**Interfaces:**
- Consumes: `createApi`, `fakeSupabase`, `FAKE_SUPABASE_URL` from Task 1.
- Produces:
  - `QuizAttemptInput` gains `id?: string` and `answered_at?: string`.
  - `StudySessionInput` gains `id?: string` and `started_at?: string`.
  - `api.quizAttempts.createQuizAttempt(input): Promise<void>`, safe to repeat when `id` is given.
  - `api.studySessions.createStudySession(input): Promise<StudySession | null>`. It resolves to `null` when a row with that `id` already existed. DR-15's outbox relies on these contracts.

- [ ] **Step 1: Write the failing unit tests**

`packages/core/src/api/inserts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createApi } from './index'
import { fakeSupabase } from './testing/fakeSupabase'

const attempt = {
  card_id: 'card-1',
  is_correct: true,
  attempt_count: 1,
  session_id: 'session-1',
  resolved_direction: null,
}

const session = {
  study_set_id: 'set-1',
  mode: 'meaning' as const,
  direction: null,
  visibility: 'both' as const,
  deck_size: 10,
}

describe('createQuizAttempt', () => {
  it('inserts with ON CONFLICT (id) DO NOTHING', async () => {
    const { client, requests } = fakeSupabase(() => ({ status: 201 }))

    await createApi(client).quizAttempts.createQuizAttempt(attempt)

    expect(requests[0].method).toBe('POST')
    expect(requests[0].url.pathname).toBe('/rest/v1/quiz_attempts')
    expect(requests[0].url.searchParams.get('on_conflict')).toBe('id')
    expect(requests[0].headers.get('prefer')).toContain('resolution=ignore-duplicates')
  })

  it('sends a client-chosen id and answered_at when given', async () => {
    const { client, requests } = fakeSupabase(() => ({ status: 201 }))

    await createApi(client).quizAttempts.createQuizAttempt({
      ...attempt,
      id: 'attempt-1',
      answered_at: '2026-10-15T09:00:00.000Z',
    })

    expect(requests[0].body).toMatchObject({
      id: 'attempt-1',
      answered_at: '2026-10-15T09:00:00.000Z',
    })
  })

  it('omits id when not given, so the database generates one', async () => {
    const { client, requests } = fakeSupabase(() => ({ status: 201 }))

    await createApi(client).quizAttempts.createQuizAttempt(attempt)

    expect(requests[0].body).not.toHaveProperty('id')
  })

  it('throws database errors with their code', async () => {
    const { client } = fakeSupabase(() => ({
      status: 400,
      body: { code: 'P0001', message: 'card_id card-1 does not exist' },
    }))

    await expect(createApi(client).quizAttempts.createQuizAttempt(attempt)).rejects.toMatchObject({
      code: 'P0001',
    })
  })
})

describe('createStudySession', () => {
  it('inserts with ON CONFLICT (id) DO NOTHING and returns the new row', async () => {
    const row = { ...session, id: 'session-1', owner_id: 'u', cards_correct: 0, started_at: 't', completed_at: null }
    const { client, requests } = fakeSupabase(() => ({ status: 201, body: [row] }))

    const created = await createApi(client).studySessions.createStudySession({
      ...session,
      id: 'session-1',
      started_at: '2026-10-15T09:00:00.000Z',
    })

    expect(created).toEqual(row)
    expect(requests[0].url.searchParams.get('on_conflict')).toBe('id')
    expect(requests[0].headers.get('prefer')).toContain('resolution=ignore-duplicates')
    expect(requests[0].body).toMatchObject({ id: 'session-1', started_at: '2026-10-15T09:00:00.000Z' })
  })

  it('returns null when a session with that id already exists (a retried send)', async () => {
    const { client } = fakeSupabase(() => ({ status: 201, body: [] }))

    const created = await createApi(client).studySessions.createStudySession({ ...session, id: 'session-1' })

    expect(created).toBeNull()
  })
})
```

The web side of the `null` case is pinned by typecheck: once `createStudySession` returns `StudySession | null`, the two `onSuccess: (session) => setSessionId(session.id)` calls in `StudySessionPage.tsx` stop compiling until Step 3 guards them.

- [ ] **Step 2: Run them to verify they fail**

Run: `bun run --filter @escritorio/core test -- inserts`
Expected: FAIL in 3 tests. The `on_conflict`/`resolution=ignore-duplicates` assertions fail (plain insert), and the null case rejects with PGRST116 (`.single()` on 0 rows). The id/answered_at pass-through and error-code tests already pass at runtime, because Vitest doesn't typecheck; they pin behaviour the change must keep.

- [ ] **Step 3: Implement**

`packages/core/src/types/quizAttempt.ts`. Add to `QuizAttemptInput`:

```ts
  // Client-generated when the attempt is recorded offline, so a retried
  // send is a no-op instead of a duplicate row. Omitted: the database
  // generates the id and stamps answered_at with now().
  id?: string
  answered_at?: string
```

`packages/core/src/types/studySession.ts`. Add to `StudySessionInput`:

```ts
  // See QuizAttemptInput.id.
  id?: string
  started_at?: string
```

`packages/core/src/api/quizAttempts.ts`. Replace the body of `createQuizAttempt`:

```ts
  // ON CONFLICT (id) DO NOTHING: re-sending an attempt that already landed
  // (e.g. the response was lost) is a no-op, not a duplicate row.
  async function createQuizAttempt(input: QuizAttemptInput): Promise<void> {
    const { error } = await supabase
      .from('quiz_attempts')
      .upsert(input, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  }
```

`packages/core/src/api/studySessions.ts`. Replace `createStudySession`:

```ts
  /**
   * ON CONFLICT (id) DO NOTHING, like createQuizAttempt. Resolves to null
   * when a session with this id already existed: the earlier send landed.
   */
  async function createStudySession(input: StudySessionInput): Promise<StudySession | null> {
    const { data, error } = await supabase
      .from('study_sessions')
      .upsert(input, { onConflict: 'id', ignoreDuplicates: true })
      .select('*')
      .maybeSingle()
    if (error) throw error
    return data
  }
```

`apps/web/src/features/study/StudySessionPage.tsx`. In both `startSession.mutate` calls, change `{ onSuccess: (session) => setSessionId(session.id) }` to:

```ts
        // Null only when re-sending a session id that already exists, which
        // web never does (it lets the database pick the id).
        { onSuccess: (session) => session && setSessionId(session.id) },
```

- [ ] **Step 4: Run them to verify they pass**

Run: `bun run --filter @escritorio/core test && bun run typecheck`
Expected: PASS, and typecheck is clean in both workspaces.

- [ ] **Step 5: Write the integration test (RLS check)**

`packages/core/src/api/api.integration.test.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApi, type Api } from './index'

// Runs only against a local stack:
//   bun run db:start && bun run --filter @escritorio/core test:integration
// It proves the RLS behaviour unit tests can't: ON CONFLICT DO NOTHING
// under insert-only policies, and lineage-trigger errors.
const url = process.env.SUPABASE_INTEGRATION_URL
const anonKey = process.env.SUPABASE_INTEGRATION_ANON_KEY

describe.skipIf(!url || !anonKey)('API against local Supabase', () => {
  let supabase: SupabaseClient
  let api: Api
  let studySetId: string
  let cardId: string

  beforeAll(async () => {
    supabase = createClient(url!, anonKey!, { auth: { persistSession: false } })
    const { data, error } = await supabase.auth.signUp({
      email: `it-${randomUUID()}@example.test`,
      password: 'integration-test-password',
    })
    if (error) throw error
    api = createApi(supabase)
    const set = await api.studySets.createStudySet(data.user!.id, { title: 'Integration', description: null, image_path: null })
    studySetId = set.id
    cardId = randomUUID()
    await api.cards.createCard(cardId, studySetId, {
      spanish_term: 'hola',
      english_equivalent: 'hello',
      definition: null,
      hint: null,
      image_path: null,
      position: 0,
    })
  })

  async function count(table: string, column: string, value: string) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq(column, value)
    if (error) throw error
    return count
  }

  it('a re-sent study session lands once, with the client timestamp', async () => {
    const id = randomUUID()
    const input = {
      id,
      study_set_id: studySetId,
      mode: 'meaning' as const,
      direction: null,
      visibility: 'both' as const,
      deck_size: 1,
      started_at: '2026-01-02T03:04:05.000Z',
    }

    const first = await api.studySessions.createStudySession(input)
    const second = await api.studySessions.createStudySession(input)

    expect(first?.started_at).toBe('2026-01-02T03:04:05+00:00')
    expect(second).toBeNull()
    expect(await count('study_sessions', 'id', id)).toBe(1)
  })

  it('a re-sent quiz attempt lands once, with the client timestamp', async () => {
    const id = randomUUID()
    const input = {
      id,
      card_id: cardId,
      is_correct: true,
      attempt_count: 1,
      session_id: null,
      resolved_direction: null,
      answered_at: '2026-01-02T03:04:05.000Z',
    }

    await api.quizAttempts.createQuizAttempt(input)
    await api.quizAttempts.createQuizAttempt(input)

    expect(await count('quiz_attempts', 'id', id)).toBe(1)
    const { data } = await supabase.from('quiz_attempts').select('answered_at').eq('id', id).single()
    expect(data?.answered_at).toBe('2026-01-02T03:04:05+00:00')
  })

  it('attempts sent without an id are never deduplicated', async () => {
    const before = (await count('quiz_attempts', 'card_id', cardId)) ?? 0
    const input = { card_id: cardId, is_correct: false, attempt_count: 3, session_id: null, resolved_direction: null }

    await api.quizAttempts.createQuizAttempt(input)
    await api.quizAttempts.createQuizAttempt(input)

    expect(await count('quiz_attempts', 'card_id', cardId)).toBe(before + 2)
  })

  it('an attempt for a deleted card rejects with the lineage trigger code', async () => {
    await expect(
      api.quizAttempts.createQuizAttempt({
        id: randomUUID(),
        card_id: randomUUID(),
        is_correct: true,
        attempt_count: 1,
        session_id: null,
        resolved_direction: null,
      }),
    ).rejects.toMatchObject({ code: 'P0001' })
  })
})
```

Add to `packages/core/package.json` `scripts`:

```json
"test:integration": "SUPABASE_INTEGRATION_URL=${SUPABASE_INTEGRATION_URL:-http://127.0.0.1:54321} SUPABASE_INTEGRATION_ANON_KEY=${SUPABASE_INTEGRATION_ANON_KEY:-$(cd ../.. && bunx supabase status -o env | sed -n 's/^ANON_KEY=\"\\(.*\\)\"$/\\1/p')} vitest run api.integration"
```

- [ ] **Step 6: Run the integration test against the local stack**

Run: `bun run db:start && bun run db:reset && bun run --filter @escritorio/core test:integration`
Expected: 4/4 pass. This is the spec's "verify during implementation" check.

**If the two "re-sent" tests fail with an RLS or permission error (`42501`)**, PostgREST is requiring update rights for this path. Apply the spec's fallback instead:
- In `quizAttempts.ts`:
  ```ts
  const UNIQUE_VIOLATION = '23505'
  const { error } = await supabase.from('quiz_attempts').insert(input)
  if (error && error.code !== UNIQUE_VIOLATION) throw error
  ```
- In `studySessions.ts`: `insert(input).select('*').single()`, and return `null` when `error.code === '23505'`.
- Change the unit tests' `on_conflict`/`prefer` assertions to assert a plain POST, and add a unit test where the fake returns `{ status: 409, body: { code: '23505' } }` and the call resolves (`null` for the session).
- Re-run Steps 4 and 6, and record a ledger ruling.

Then stop the stack: `bun run db:stop`.

The default `bun run test` must stay green and skip this file when the env vars are unset: run `bun run test` and confirm the suite reports the 4 integration tests as skipped.

- [ ] **Step 7: Commit**

```bash
git add packages/core apps/web/src/features/study/StudySessionPage.tsx
git commit -m "feat(core): retry-safe study session and quiz attempt inserts

Optional client ids and timestamps; ON CONFLICT (id) DO NOTHING so a
re-sent offline write is a no-op. Verified against local RLS.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Image uploads take `Blob | ArrayBuffer` plus a content type

**Files:**
- Modify: `packages/core/src/api/cardImages.ts`, `packages/core/src/api/studySetImages.ts`
- Create: `packages/core/src/api/uploads.test.ts`
- Modify: `apps/web/src/features/study-sets/hooks/useCards.ts`, `apps/web/src/features/study-sets/hooks/useStudySets.ts`

**Interfaces:**
- Consumes: `createApi` and `fakeSupabase` from Task 1.
- Produces:
  - `api.cardImages.uploadCardImage(path, body: Blob | ArrayBuffer, options: { contentType: string; upsert?: boolean }): Promise<void>`
  - `api.studySetImages.uploadStudySetImage(path, body: Blob | ArrayBuffer, options: { contentType: string; upsert?: boolean }): Promise<void>`

- [ ] **Step 1: Write the failing tests**

`packages/core/src/api/uploads.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createApi } from './index'
import { fakeSupabase } from './testing/fakeSupabase'

const ok = () => ({ body: { Key: 'flashcard-images/x', Id: 'x' } })

describe.each([
  ['card image', (api: ReturnType<typeof createApi>) => api.cardImages.uploadCardImage, 'u/c1.webp'],
  ['study set image', (api: ReturnType<typeof createApi>) => api.studySetImages.uploadStudySetImage, 'u/sets/s1.webp'],
] as const)('upload %s', (_, pick, path) => {
  it('sends an ArrayBuffer with the given content type', async () => {
    const { client, requests } = fakeSupabase(ok)

    await pick(createApi(client))(path, new Uint8Array([1, 2, 3]).buffer, { contentType: 'image/webp' })

    expect(requests[0].method).toBe('POST')
    expect(requests[0].url.pathname).toBe(`/storage/v1/object/flashcard-images/${path}`)
    expect(requests[0].headers.get('content-type')).toBe('image/webp')
    expect(requests[0].headers.get('x-upsert')).toBe('false')
  })

  it('sends a Blob as multipart, keeping the blob’s own type', async () => {
    const { client, requests } = fakeSupabase(ok)

    await pick(createApi(client))(path, new Blob(['img'], { type: 'image/png' }), {
      contentType: 'image/png',
    })

    expect(requests[0].headers.get('content-type')).toMatch(/^multipart\/form-data/)
    expect(String(requests[0].body)).toContain('Content-Type: image/png')
  })

  it('overwrites when upsert is set', async () => {
    const { client, requests } = fakeSupabase(ok)

    await pick(createApi(client))(path, new Uint8Array([1]).buffer, {
      contentType: 'image/webp',
      upsert: true,
    })

    expect(requests[0].headers.get('x-upsert')).toBe('true')
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `bun run --filter @escritorio/core test -- uploads`
Expected: FAIL. The ArrayBuffer case sends `content-type: text/plain;charset=UTF-8` (storage-js's default), not `image/webp`, because `contentType` isn't passed through. Typecheck also rejects the `ArrayBuffer` argument and the `contentType` option.

- [ ] **Step 3: Implement**

In `cardImages.ts`, replace `uploadCardImage`:

```ts
  // Blob (web File) uploads as multipart and keeps the blob's own type;
  // ArrayBuffer (React Native, which can't upload Blobs) is sent raw with
  // contentType, so images are served with the right MIME type either way.
  async function uploadCardImage(
    path: string,
    body: Blob | ArrayBuffer,
    { contentType, upsert = false }: { contentType: string; upsert?: boolean },
  ): Promise<void> {
    const { error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, body, { contentType, upsert })
    if (error) throw error
  }
```

In `studySetImages.ts`, replace `uploadStudySetImage`:

```ts
  // See uploadCardImage for why Blob and ArrayBuffer are handled differently.
  async function uploadStudySetImage(
    path: string,
    body: Blob | ArrayBuffer,
    { contentType, upsert = false }: { contentType: string; upsert?: boolean },
  ): Promise<void> {
    const { error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, body, { contentType, upsert })
    if (error) throw error
  }
```

Update the web callers. `image` is a `File` there, after `optimizeImage`.

`useCards.ts`:
- `api.cardImages.uploadCardImage(imagePath, image)` becomes `api.cardImages.uploadCardImage(imagePath, image, { contentType: image.type })`
- `api.cardImages.uploadCardImage(newPath, image, { upsert: true })` becomes `api.cardImages.uploadCardImage(newPath, image, { contentType: image.type, upsert: true })`
- `api.cardImages.uploadCardImage(newPath, image)` becomes `api.cardImages.uploadCardImage(newPath, image, { contentType: image.type })`

`useStudySets.ts`:
- `api.studySetImages.uploadStudySetImage(newPath, image, { upsert: true })` becomes `api.studySetImages.uploadStudySetImage(newPath, image, { contentType: image.type, upsert: true })`
- `api.studySetImages.uploadStudySetImage(newPath, image)` becomes `api.studySetImages.uploadStudySetImage(newPath, image, { contentType: image.type })`

- [ ] **Step 4: Run them to verify they pass**

Run: `bun run --filter @escritorio/core test && bun run typecheck`
Expected: PASS, and typecheck is clean in both workspaces (core still without DOM libs; `Blob` comes from `@types/node`).

- [ ] **Step 5: Full verification**

Run: `bun run test && bun run lint && bun run build`
Expected: all tests pass (integration tests skipped), the same 3 lint warnings as before, and the build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/core apps/web/src/features/study-sets/hooks
git commit -m "feat(core): image uploads take Blob | ArrayBuffer plus content type

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After the tasks

- Final whole-branch review: `git merge-base feat/dr-10-ios-16-monorepo-restructure-appsweb-packagescore HEAD` is the merge base, so review only DR-11's commits.
- Publish with `gh stack submit` (PR base: the DR-10 branch). Link the PR on Linear DR-11 and move it to In Review.
- The PR body must ask for a manual check: create a card with an image on the web, edit its image, study a few cards, and confirm a `study_sessions` row and its `quiz_attempts` appear in Supabase.
