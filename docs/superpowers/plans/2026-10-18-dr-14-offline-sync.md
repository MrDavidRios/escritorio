# DR-14 Offline Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in learner can study every one of their sets in airplane mode. Each session and attempt lands in Supabase exactly once, after the phone is back online.

**Architecture:**

- **Read path.** The TanStack Query cache is persisted to AsyncStorage, never expires, and runs `offlineFirst`. A sync engine refreshes it: send the outbox, fetch every set and card, then mirror images.
- **Write path.** A persisted FIFO outbox replaces DR-13's in-memory writer. It sends one op at a time and sorts each failure into transient, auth, permanent or duplicate.
- **Images.** Files live in `documentDirectory/images`, tracked by a manifest keyed on storage `updated_at`. Screens only render local `file://` URIs.
- **Testable core.** Every engine (outbox, image store, sync engine) is a plain module whose API, storage and file system are passed in. App instances are wired in one file, `features/sync/instances.ts`.

**Tech Stack:** Expo SDK 58, TanStack Query 5 (`@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister`), `@react-native-community/netinfo`, `expo-file-system` (SDK 58 `File` / `Directory` / `Paths` API), `jest-expo` + RNTL 14, Vitest for `packages/core`.

**Spec:** `docs/superpowers/specs/2026-10-13-ios-app-design.md`. Relevant sections:

- Offline sync (read path, write path: outbox, error handling)
- Mobile app → Auth (offline gating, sign-out, the different-user rules)
- Mobile app → Screens (the `/` sync status line)
- Testing
- Rollout step 5

**Stacking:** branch `feat/dr-14-ios-56-offline-sync-persisted-cache-outbox-image-store`, created with `gh stack add` on top of `feat/shared-theme-tokens` (PR #31). Publish with `gh stack submit`.

## Global Constraints

- **Cache:** persisted to AsyncStorage. `gcTime: Infinity`, persister `maxAge: Infinity`, all queries `networkMode: 'offlineFirst'`. `onlineManager` is driven by `@react-native-community/netinfo`.
- **Sync triggers:** app launch, return to the foreground, reconnect, pull-to-refresh, and a "Sync now" API (its button comes in DR-15). Only one sync runs at a time; triggers during a run merge into one follow-up run.
- **A sync run, in order:**
  1. Send the outbox.
  2. Fetch all of the user's sets and all their cards, and replace the cached copies. Sets deleted on the server disappear locally.
  3. Image sync.
- **Image sync:**
  - The wanted set is every non-null `cards.image_path` and `study_sets.image_path`.
  - Remote versions come from `storage.list()` `updated_at`.
  - Download what's missing or changed: batch `createSignedUrls`, four downloads at a time. Delete files no longer wanted.
  - Files live in `documentDirectory/images`.
  - Screens only render local `file://` URIs.
- **Outbox:**
  - A persisted FIFO queue, sent one op at a time. Ops: `createStudySession`, `completeStudySession`, `createQuizAttempt`.
  - Ids and timestamps are created on the phone, so a re-send is a no-op (upsert with `ignoreDuplicates`).
- **Error handling:**
  - Network or 5xx: stop, keep the queue, retry on the next trigger with exponential backoff.
  - 401: refresh the token. If refreshing fails, pause and prompt sign-in; the outbox is kept for the same user.
  - Other 4xx: move the op to a persisted "couldn't sync" list and continue.
  - A failed image download: show a placeholder and retry next sync.
- **Auth:**
  - Explicit sign-out clears the cache, the image store and the outbox, and warns first if the outbox isn't empty.
  - A session that ends on its own (refresh token rejected) keeps them.
  - A different user signing in discards the previous user's data, after a warning.
- **Packages:** add packages with `bunx expo install` only. `@react-native-community/netinfo` and `expo-file-system` are native: Expo Go includes them, but a dev build needs `bunx expo run:ios --device` after this PR.
- **Tests:** `jest-expo` + RNTL 14. `render`, `fireEvent` and `act` are async, so always `await` them. Core uses Vitest.
- **Commits:** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Verified while planning

Against the local Supabase stack, with a throwaway script:

- `storage.from('flashcard-images').list(owner)` returns `updated_at` for each file.
- Overwriting a file at the same path (`upsert: true`) changes its `updated_at`.
- The `sets` sub-folder comes back as an entry with `id: null`. Set images need their own `list(owner + '/sets')` call.
- `limit` / `offset` paginate.

DR-11's integration tests already cover the upsert path:

- `ON CONFLICT DO NOTHING` upserts succeed under the insert-only RLS policies.
- An attempt for a deleted card fails with code `P0001`.

### Rulings made while planning (spec gaps)

- **Error classes come from the PostgREST `code`.** Core throws the PostgREST error object, which has no HTTP status.
  - `23505` means it already landed, so it counts as sent.
  - `PGRST301`/`302`/`303`, or a "JWT" message, is auth.
  - An empty code (a network failure, or a non-JSON 5xx), `PGRST00x`, or SQLSTATE classes `08` `40` `53` `57` `58` `XX` are transient.
  - Everything else is permanent. That includes `P0001` (lineage trigger), `23503`, and `PGRST116` (completing a session whose row doesn't exist).
- **Backoff:**
  - A transient failure schedules an automatic retry after 5 s, 10 s, 20 s … capped at 5 minutes.
  - Any trigger (foreground, reconnect, pull, a new answer) also retries straight away.
  - After a token refresh, an op gets one retry. A second auth error on the same op pauses the outbox.
- **"Prompt sign-in"** means:
  - When auth-js rejects the refresh token online, it emits `SIGNED_OUT`, and the existing `AuthProvider` sends the user to the sign-in screen.
  - The outbox stays paused until a user signs in.
  - `SyncProvider` calls `outbox.resume()` on sign-in.
- **Local data owner:**
  - The signed-in user's id is stored under `escritorio-local-owner`.
  - When a different user signs in, everything is wiped before any screen renders, and an alert says how many unsynced results were discarded.
  - `AuthProvider`'s `onSignedOut` stops clearing the cache, because a session that ended on its own keeps its data.
- **Owner id for the image listing** comes from the synced sets' `owner_id`. With no sets, nothing is wanted, so nothing is listed, and any old files are removed.
- **New file name per image version** (`<path>-<updatedAt ms>.<ext>`). A replaced image gets a new `file://` URI, so `expo-image` can never show its cached old copy.
- **All cards in one paged query.** PostgREST caps a response at max-rows (1000 on hosted Supabase), so `listAllCards` pages by 1000 until a short page comes back. The storage listing pages by 100.
- **Status line** (set list header), first match wins:
  - `Offline`, plus `· N answers waiting to sync` when attempts are queued
  - `Syncing…`
  - `N answers waiting to sync`
  - `Couldn't sync. Pull down to try again.`
  - `Synced just now` / `Synced N min ago` / `Synced N h ago` / `Synced N days ago`
  - `Not synced yet`

  The number counts queued attempts only. Session ops aren't counted, because the learner thinks in answers.

- **"Couldn't sync" list:** persisted and exposed as `outbox.getState().failed`. DR-15's Settings screen shows the count.
- **Placeholder copy:** QuizCard's "Loading image…" becomes "Image not downloaded yet". Offline, the old text would claim to be loading forever.
- **DR-13's in-memory `createStudyWriter` is deleted.** The `StudyWriter` type moves to `features/study/writer.ts`, and `idle()` is dropped (only its own tests used it).

## Review Focus

1. **A different user signs in on the same phone.** They must never see the previous user's cached sets, and that user's queued results must never be sent under the new account. Pinned by a Task 7 test (`claimLocalData`, plus `SyncProvider` rendering nothing until the claim resolves).
2. **The app is killed after an answer, then relaunched offline.** The queued op must survive the restart and be sent once online. Pinned by a Task 3 test (a new outbox on the same storage).
3. **The response to a successful insert is lost (timeout), so the op is re-sent.** It must not create a second row: same id, upsert no-op, and `23505` counts as sent. Pinned by Task 3 tests.
4. **A card is deleted on the web while the phone is offline, then answered.** The op must move to "couldn't sync", and the ops after it must still be sent. Pinned by a Task 3 test.
5. **An image is replaced on the web at the same storage path.** The phone must download the new version under a new file name and delete the old file. Pinned by a Task 5 test.

---

### Task 1: Core: all cards in one paged query, and image versions from storage

**Files:**

- Modify: `packages/core/src/api/cards.ts`
- Modify: `packages/core/src/api/cardImages.ts`
- Test: `packages/core/src/api/syncReads.test.ts`

**Interfaces:**

- Consumes: `fakeSupabase` from `packages/core/src/api/testing/fakeSupabase.ts`
- Produces:
  - `api.cards.listAllCards(): Promise<Card[]>`, ordered by `study_set_id`, then `position`, then `id`
  - `api.cardImages.listImageVersions(ownerId: string): Promise<Record<string, string>>`: storage path → `updated_at`, covering `owner/*` and `owner/sets/*`

- [ ] **Step 1: Write the failing test**

`packages/core/src/api/syncReads.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createApi } from './index'
import { fakeSupabase } from './testing/fakeSupabase'

const card = (n: number) => ({ id: `c${n}`, study_set_id: 's1', position: n })

describe('listAllCards', () => {
  it('pages through every card the user owns, in set and position order', async () => {
    const { client, requests } = fakeSupabase((request) => {
      const offset = Number(request.url.searchParams.get('offset') ?? 0)
      return { body: offset === 0 ? Array.from({ length: 1000 }, (_, i) => card(i)) : [card(1000)] }
    })

    const cards = await createApi(client).cards.listAllCards()

    expect(cards).toHaveLength(1001)
    expect(requests).toHaveLength(2)
    expect(requests[0].url.pathname).toBe('/rest/v1/cards')
    expect(requests[0].url.searchParams.get('study_set_id')).toBeNull()
    expect(requests[0].url.searchParams.get('order')).toBe('study_set_id.asc,position.asc,id.asc')
    expect(requests.map((r) => r.url.searchParams.get('offset'))).toEqual(['0', '1000'])
    expect(requests[0].url.searchParams.get('limit')).toBe('1000')
  })

  it('stops after one request when the first page is short', async () => {
    const { client, requests } = fakeSupabase(() => ({ body: [card(0)] }))
    expect(await createApi(client).cards.listAllCards()).toEqual([card(0)])
    expect(requests).toHaveLength(1)
  })
})

describe('listImageVersions', () => {
  const file = (name: string, updated_at: string) => ({ name, id: `id-${name}`, updated_at })

  it('maps every card and set image path to its updated_at, paging each folder', async () => {
    const { client, requests } = fakeSupabase((request) => {
      const { prefix, offset } = request.body as { prefix: string; offset: number }
      if (prefix === 'u1/sets') return { body: [file('s1.png', '2026-10-02T00:00:00Z')] }
      if (offset === 0) {
        return {
          body: Array.from({ length: 100 }, (_, i) => file(`c${i}.png`, '2026-10-01T00:00:00Z')),
        }
      }
      // Last page of the owner folder, with the `sets` sub-folder entry.
      return {
        body: [
          file('c100.png', '2026-10-03T00:00:00Z'),
          { name: 'sets', id: null, updated_at: null },
        ],
      }
    })

    const versions = await createApi(client).cardImages.listImageVersions('u1')

    expect(Object.keys(versions)).toHaveLength(102)
    expect(versions['u1/c0.png']).toBe('2026-10-01T00:00:00Z')
    expect(versions['u1/c100.png']).toBe('2026-10-03T00:00:00Z')
    expect(versions['u1/sets/s1.png']).toBe('2026-10-02T00:00:00Z')
    expect(versions['u1/sets']).toBeUndefined()
    expect(requests.map((r) => r.url.pathname)).toEqual([
      '/storage/v1/object/list/flashcard-images',
      '/storage/v1/object/list/flashcard-images',
      '/storage/v1/object/list/flashcard-images',
    ])
    expect(requests.map((r) => (r.body as { prefix: string; offset: number }).offset)).toEqual([
      0, 100, 0,
    ])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run --filter @escritorio/core test -- syncReads`
Expected: FAIL with "listAllCards is not a function".

- [ ] **Step 3: Write the implementation**

In `packages/core/src/api/cards.ts`, add above `export function createCardsApi`:

```ts
// PostgREST caps one response at its max-rows setting (1000 on hosted Supabase).
const CARDS_PAGE_SIZE = 1000
```

Inside `createCardsApi`, add before `return`:

```ts
/** Every card the signed-in user owns (RLS scopes it), for the offline mirror. */
async function listAllCards(): Promise<Card[]> {
  const all: Card[] = []
  for (let from = 0; ; from += CARDS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .order('study_set_id', { ascending: true })
      .order('position', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + CARDS_PAGE_SIZE - 1)
    if (error) throw error
    all.push(...data)
    if (data.length < CARDS_PAGE_SIZE) return all
  }
}
```

and change the return to `return { listCards, listAllCards, createCard, updateCard, deleteCard }`.

In `packages/core/src/api/cardImages.ts`, add below `SIGNED_URL_STALE_TIME_MS`:

```ts
const LIST_PAGE_SIZE = 100
```

Inside `createCardImagesApi`, add before `return`:

```ts
/**
 * Storage path → updated_at for every image the user has stored: card
 * images (`owner/<card>.ext`) and set images (`owner/sets/<set>.ext`).
 * Images are overwritten in place, so updated_at is how the offline
 * mirror notices a replaced image.
 */
async function listImageVersions(ownerId: string): Promise<Record<string, string>> {
  const versions: Record<string, string> = {}
  for (const folder of [ownerId, `${ownerId}/sets`]) {
    for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
      const { data, error } = await supabase.storage.from(IMAGE_BUCKET).list(folder, {
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      })
      if (error) throw error
      for (const object of data) {
        // Sub-folders (like `sets`) are listed with a null id.
        if (object.id && object.updated_at) versions[`${folder}/${object.name}`] = object.updated_at
      }
      if (data.length < LIST_PAGE_SIZE) break
    }
  }
  return versions
}
```

and add `listImageVersions,` to the returned object.

- [ ] **Step 4: Run tests and typecheck**

Run: `bun run --filter @escritorio/core test && bun run --filter @escritorio/core typecheck`
Expected: every core test PASSES, including 3 new ones. No type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/api
git commit -m "feat(core): list all cards in pages and image versions from storage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Persisted, offline-first query cache and NetInfo-driven online state

**Files:**

- Modify: `apps/mobile/package.json`, `bun.lock` (via `bunx expo install`)
- Modify: `apps/mobile/src/lib/queryClient.ts`
- Create: `apps/mobile/src/lib/online.ts`
- Modify: `apps/mobile/jest.setup.js` (NetInfo mock)
- Modify: `apps/mobile/src/app/_layout.tsx`
- Test: `apps/mobile/src/lib/queryClient.test.ts`, `apps/mobile/src/lib/online.test.ts`

**Interfaces:**

- Produces:
  - `createQueryClient(): QueryClient` and `queryClient` (`@/lib/queryClient`)
  - `queryPersister`, the AsyncStorage persister (`@/lib/queryClient`)
  - `isOnline(state: { isConnected: boolean | null; isInternetReachable?: boolean | null }): boolean` (`@/lib/online`)
  - `bindOnlineManager(netInfo?: { addEventListener(listener: (state) => void): () => void }): void` (`@/lib/online`)

- [ ] **Step 1: Install the packages**

Run from `apps/mobile`: `bunx expo install @react-native-community/netinfo @tanstack/react-query-persist-client @tanstack/query-async-storage-persister`
Expected:

- `package.json` gains all three.
- The two `@tanstack/*` packages are on the same major version as `@tanstack/react-query` (5.x).
- `bun pm ls --all | grep "react-native@"` at the root still shows one `react-native`.

- [ ] **Step 2: Mock NetInfo under Jest**

Append to `apps/mobile/jest.setup.js`:

```js
// NetInfo's native module doesn't exist under Jest; use its official mock.
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js'),
)
```

- [ ] **Step 3: Write the failing tests**

`apps/mobile/src/lib/queryClient.test.ts`:

```ts
import { createQueryClient } from './queryClient'

test('cached data never expires and queries run offline-first', () => {
  const queries = createQueryClient().getDefaultOptions().queries
  expect(queries).toMatchObject({
    networkMode: 'offlineFirst',
    gcTime: Infinity,
    staleTime: Infinity,
  })
})
```

`apps/mobile/src/lib/online.test.ts`:

```ts
import { onlineManager } from '@tanstack/react-query'
import { bindOnlineManager, isOnline } from './online'

test.each([
  [{ isConnected: true, isInternetReachable: true }, true],
  [{ isConnected: true, isInternetReachable: null }, true],
  [{ isConnected: null, isInternetReachable: null }, true],
  [{ isConnected: false, isInternetReachable: null }, false],
  [{ isConnected: true, isInternetReachable: false }, false],
])('%o is online: %s', (state, expected) => {
  expect(isOnline(state)).toBe(expected)
})

test('NetInfo changes drive TanStack Query online state', () => {
  let emit: (state: { isConnected: boolean; isInternetReachable: boolean }) => void = () => {}
  bindOnlineManager({
    addEventListener: (listener) => {
      emit = listener
      return () => {}
    },
  })

  emit({ isConnected: false, isInternetReachable: false })
  expect(onlineManager.isOnline()).toBe(false)
  emit({ isConnected: true, isInternetReachable: true })
  expect(onlineManager.isOnline()).toBe(true)
})
```

- [ ] **Step 4: Run them to verify they fail**

Run from `apps/mobile`: `bunx jest src/lib/queryClient src/lib/online`
Expected: FAIL. `createQueryClient` is not a function, and `./online` can't be found.

- [ ] **Step 5: Write the implementation**

Replace `apps/mobile/src/lib/queryClient.ts` with:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'

/**
 * Offline-first: cached data is persisted to the device and never expires.
 * The sync engine (features/sync) is what refreshes it; a query only fetches
 * by itself when nothing is cached yet.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { networkMode: 'offlineFirst', gcTime: Infinity, staleTime: Infinity },
      mutations: { networkMode: 'offlineFirst' },
    },
  })
}

export const queryClient = createQueryClient()

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'escritorio-query-cache',
})
```

`apps/mobile/src/lib/online.ts`:

```ts
import NetInfo from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'

type ConnectionState = { isConnected: boolean | null; isInternetReachable?: boolean | null }

/** Unknown (null) counts as online, so a slow reachability check never blocks a sync. */
export function isOnline(state: ConnectionState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false
}

/** TanStack Query's online state follows NetInfo. Call once at startup. */
export function bindOnlineManager(
  netInfo: { addEventListener(listener: (state: ConnectionState) => void): () => void } = NetInfo,
): void {
  onlineManager.setEventListener((setOnline) =>
    netInfo.addEventListener((state) => setOnline(isOnline(state))),
  )
}
```

In `apps/mobile/src/app/_layout.tsx`:

1. Replace `import { QueryClientProvider } from '@tanstack/react-query'` with:

   ```ts
   import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
   ```

2. Add `import { bindOnlineManager } from '@/lib/online'`, and change the queryClient import to:

   ```ts
   import { queryClient, queryPersister } from '@/lib/queryClient'
   ```

3. Below the imports add:

   ```ts
   bindOnlineManager()
   ```

4. Replace `<QueryClientProvider client={queryClient}>` … `</QueryClientProvider>` with:

   ```tsx
   <PersistQueryClientProvider
     client={queryClient}
     persistOptions={{ persister: queryPersister, maxAge: Infinity }}
   >
   ```

   … and close it with `</PersistQueryClientProvider>`.

- [ ] **Step 6: Run tests, typecheck, bundle**

Run from `apps/mobile`: `bunx jest src/lib && bun run typecheck && bun run export:ios && rm -r ./dist-export`
Expected: every `src/lib` test PASSES, there are no type errors, and the export succeeds.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/package.json bun.lock apps/mobile/jest.setup.js apps/mobile/src/lib apps/mobile/src/app/_layout.tsx
git commit -m "feat(mobile): persisted offline-first query cache driven by NetInfo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The outbox

**Files:**

- Create: `apps/mobile/src/features/sync/outbox.ts`
- Test: `apps/mobile/src/features/sync/outbox.test.ts`

**Interfaces:**

- Consumes: `Api` and the `QuizAttemptInput` / `StudySessionInput` types from `@escritorio/core`
- Produces:
  - `type OutboxOp`: the `createStudySession` / `completeStudySession` / `createQuizAttempt` ops (code below)
  - `type FailedOp = { op: OutboxOp; error: string; failedAt: string }`
  - `type OutboxState = { pending: OutboxOp[]; failed: FailedOp[]; paused: boolean }`
  - `type RefreshResult = 'refreshed' | 'offline' | 'rejected'`
  - `type KeyValueStorage = { getItem(key): Promise<string | null>; setItem(key, value): Promise<void>; removeItem(key): Promise<void> }`
  - `classifyError(error: unknown): 'transient' | 'auth' | 'permanent' | 'duplicate'`
  - `createOutbox(deps): Outbox`, where `Outbox = { enqueue(op): Promise<void>; flush(): Promise<void>; resume(): Promise<void>; clear(): Promise<number>; getState(): OutboxState; subscribe(listener): () => void }`

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/features/sync/outbox.test.ts`:

```ts
import { classifyError, createOutbox, type KeyValueStorage, type OutboxOp } from './outbox'

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
  }
}

const pgError = (code: string, message = 'error') => Object.assign(new Error(message), { code })

function fakeApi() {
  const sent: string[] = []
  const api = {
    studySessions: {
      createStudySession: jest.fn(async (input: { id: string }) => {
        sent.push(`session ${input.id}`)
        return null
      }),
      completeStudySession: jest.fn(async (id: string) => {
        sent.push(`complete ${id}`)
        return {} as never
      }),
    },
    quizAttempts: {
      createQuizAttempt: jest.fn(async (input: { id: string }) => {
        sent.push(`attempt ${input.id}`)
      }),
    },
  }
  return { api, sent }
}

const session: OutboxOp = {
  type: 'createStudySession',
  id: 'sess-1',
  input: {
    id: 'sess-1',
    started_at: '2026-10-18T10:00:00.000Z',
    study_set_id: 's1',
    mode: 'conversion',
    direction: 'es_en',
    visibility: null,
    deck_size: 2,
  },
}
const attempt = (id: string): OutboxOp => ({
  type: 'createQuizAttempt',
  id,
  input: {
    id,
    answered_at: '2026-10-18T10:01:00.000Z',
    card_id: 'c1',
    is_correct: true,
    attempt_count: 1,
    session_id: 'sess-1',
    resolved_direction: 'es_en',
  },
})
const complete: OutboxOp = {
  type: 'completeStudySession',
  id: 'sess-1',
  patch: { completed_at: '2026-10-18T10:05:00.000Z', cards_correct: 1 },
}

function setup(overrides: Partial<Parameters<typeof createOutbox>[0]> = {}) {
  const { api, sent } = fakeApi()
  const storage = memoryStorage()
  const timers: { fn: () => void; ms: number }[] = []
  const deps = {
    api,
    storage,
    refreshAuth: jest.fn(async () => 'refreshed' as const),
    schedule: (fn: () => void, ms: number) => void timers.push({ fn, ms }),
    now: () => new Date('2026-10-18T12:00:00.000Z'),
    onError: jest.fn(),
    ...overrides,
  }
  return { outbox: createOutbox(deps), api, sent, storage, timers, deps }
}

const stored = (storage: { data: Map<string, string> }) =>
  JSON.parse(storage.data.get('escritorio-outbox') ?? '{"pending":[],"failed":[]}')

test('sends ops one at a time, oldest first, and empties the stored queue', async () => {
  const { outbox, sent, storage } = setup()
  await outbox.enqueue(session)
  await outbox.enqueue(attempt('a1'))
  await outbox.enqueue(complete)
  expect(stored(storage).pending).toHaveLength(3)

  await outbox.flush()

  expect(sent).toEqual(['session sess-1', 'attempt a1', 'complete sess-1'])
  expect(outbox.getState().pending).toEqual([])
  expect(stored(storage).pending).toEqual([])
})

test('queued ops survive an app restart', async () => {
  const first = setup()
  await first.outbox.enqueue(attempt('a1'))

  const { api, sent } = fakeApi()
  const relaunched = createOutbox({ ...first.deps, api, storage: first.storage })
  await relaunched.flush()

  expect(sent).toEqual(['attempt a1'])
})

test('a network error stops sending, keeps the queue and retries with backoff', async () => {
  const { outbox, api, sent, timers } = setup()
  api.quizAttempts.createQuizAttempt
    .mockRejectedValueOnce(pgError('', 'TypeError: Network request failed'))
    .mockRejectedValueOnce(pgError('', 'TypeError: Network request failed'))
  await outbox.enqueue(attempt('a1'))
  await outbox.enqueue(attempt('a2'))

  await outbox.flush()
  expect(sent).toEqual([])
  expect(outbox.getState().pending).toHaveLength(2)
  expect(timers.map((t) => t.ms)).toEqual([5_000])

  timers[0].fn()
  await outbox.flush()
  expect(timers.map((t) => t.ms)).toEqual([5_000, 10_000])

  await outbox.flush()
  // The retried op keeps its id, so the server's upsert can't double it.
  expect(sent).toEqual(['attempt a1', 'attempt a2'])
  expect(api.quizAttempts.createQuizAttempt.mock.calls.map(([input]) => input.id)).toEqual([
    'a1',
    'a1',
    'a1',
    'a2',
  ])
})

test('an op the server already has (23505) counts as sent', async () => {
  const { outbox, api } = setup()
  api.quizAttempts.createQuizAttempt.mockRejectedValueOnce(pgError('23505', 'duplicate key'))
  await outbox.enqueue(attempt('a1'))
  await outbox.flush()
  expect(outbox.getState()).toMatchObject({ pending: [], failed: [] })
})

test('a rejected op moves to the "couldn\'t sync" list and the rest still go', async () => {
  const { outbox, api, sent, storage } = setup()
  api.quizAttempts.createQuizAttempt.mockRejectedValueOnce(pgError('P0001', 'card does not exist'))
  await outbox.enqueue(attempt('a1'))
  await outbox.enqueue(complete)

  await outbox.flush()

  expect(sent).toEqual(['complete sess-1'])
  expect(outbox.getState().failed).toEqual([
    { op: attempt('a1'), error: 'card does not exist', failedAt: '2026-10-18T12:00:00.000Z' },
  ])
  expect(stored(storage).failed).toHaveLength(1)
})

test('an auth error refreshes the token and retries the op', async () => {
  const { outbox, api, sent, deps } = setup()
  api.quizAttempts.createQuizAttempt.mockRejectedValueOnce(pgError('PGRST303', 'JWT expired'))
  await outbox.enqueue(attempt('a1'))
  await outbox.flush()
  expect(deps.refreshAuth).toHaveBeenCalledTimes(1)
  expect(sent).toEqual(['attempt a1'])
})

test('a rejected refresh pauses the outbox until resume, keeping the op', async () => {
  const { outbox, api, sent } = setup({ refreshAuth: jest.fn(async () => 'rejected' as const) })
  api.quizAttempts.createQuizAttempt.mockRejectedValueOnce(pgError('PGRST303', 'JWT expired'))
  await outbox.enqueue(attempt('a1'))

  await outbox.flush()
  expect(outbox.getState()).toMatchObject({ paused: true, pending: [attempt('a1')] })
  await outbox.flush()
  expect(sent).toEqual([])

  await outbox.resume()
  await outbox.flush()
  expect(sent).toEqual(['attempt a1'])
})

test('a refresh that fails offline is retried later, not a pause', async () => {
  const { outbox, api, timers } = setup({ refreshAuth: jest.fn(async () => 'offline' as const) })
  api.quizAttempts.createQuizAttempt.mockRejectedValueOnce(pgError('PGRST303', 'JWT expired'))
  await outbox.enqueue(attempt('a1'))
  await outbox.flush()
  expect(outbox.getState().paused).toBe(false)
  expect(timers).toHaveLength(1)
})

test('a second auth error after a refresh pauses instead of looping', async () => {
  const { outbox, api, deps } = setup()
  api.quizAttempts.createQuizAttempt.mockRejectedValue(pgError('PGRST301', 'JWT invalid'))
  await outbox.enqueue(attempt('a1'))
  await outbox.flush()
  expect(deps.refreshAuth).toHaveBeenCalledTimes(1)
  expect(outbox.getState().paused).toBe(true)
})

test('clear drops everything and reports how many unsent ops were discarded', async () => {
  const { outbox, storage } = setup()
  await outbox.enqueue(attempt('a1'))
  await outbox.enqueue(attempt('a2'))
  expect(await outbox.clear()).toBe(2)
  expect(outbox.getState()).toEqual({ pending: [], failed: [], paused: false })
  expect(storage.data.has('escritorio-outbox')).toBe(false)
})

test('subscribers hear about every change', async () => {
  const { outbox } = setup()
  const listener = jest.fn()
  outbox.subscribe(listener)
  await outbox.enqueue(attempt('a1'))
  await outbox.flush()
  expect(listener).toHaveBeenCalledTimes(2)
})

test.each([
  [pgError('', 'TypeError: Network request failed'), 'transient'],
  [new TypeError('Network request failed'), 'transient'],
  [pgError('PGRST000'), 'transient'],
  [pgError('57014'), 'transient'],
  [pgError('PGRST303', 'JWT expired'), 'auth'],
  [pgError('PGRST301'), 'auth'],
  [pgError('23505'), 'duplicate'],
  [pgError('P0001'), 'permanent'],
  [pgError('23503'), 'permanent'],
  [pgError('PGRST116'), 'permanent'],
  [pgError('42501'), 'permanent'],
])('classifies %o as %s', (error, expected) => {
  expect(classifyError(error)).toBe(expected)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run from `apps/mobile`: `bunx jest src/features/sync/outbox`
Expected: FAIL with "Cannot find module './outbox'".

- [ ] **Step 3: Write the implementation**

`apps/mobile/src/features/sync/outbox.ts`:

```ts
import type { Api, QuizAttemptInput, StudySessionInput } from '@escritorio/core'

export type OutboxOp =
  | {
      type: 'createStudySession'
      id: string
      input: StudySessionInput & { id: string; started_at: string }
    }
  | {
      type: 'completeStudySession'
      id: string
      patch: { completed_at: string; cards_correct: number }
    }
  | {
      type: 'createQuizAttempt'
      id: string
      input: QuizAttemptInput & { id: string; answered_at: string }
    }

export type FailedOp = { op: OutboxOp; error: string; failedAt: string }
export type OutboxState = { pending: OutboxOp[]; failed: FailedOp[]; paused: boolean }
export type RefreshResult = 'refreshed' | 'offline' | 'rejected'

export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export type OutboxApi = {
  studySessions: Pick<Api['studySessions'], 'createStudySession' | 'completeStudySession'>
  quizAttempts: Pick<Api['quizAttempts'], 'createQuizAttempt'>
}

export type Outbox = {
  enqueue(op: OutboxOp): Promise<void>
  /** Sends until the queue is empty, a transient error, or an auth pause. */
  flush(): Promise<void>
  /** After a user signs back in: unpause (the caller then flushes). */
  resume(): Promise<void>
  /** Drops pending and failed ops; resolves to how many pending ops were discarded. */
  clear(): Promise<number>
  getState(): OutboxState
  subscribe(listener: () => void): () => void
}

const STORAGE_KEY = 'escritorio-outbox'
const BASE_RETRY_MS = 5_000
const MAX_RETRY_MS = 5 * 60_000

const AUTH_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303'])
// Connection, rollback, resource, operator-intervention, system and internal errors.
const TRANSIENT_SQLSTATE = /^(08|40|53|57|58|XX)/

/**
 * Core throws the PostgREST error object, which carries a code but no HTTP
 * status. An empty code is a network failure (or a non-JSON 5xx page).
 */
export function classifyError(error: unknown): 'transient' | 'auth' | 'permanent' | 'duplicate' {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown }
  const c = typeof code === 'string' ? code : ''
  if (c === '23505') return 'duplicate'
  if (AUTH_CODES.has(c) || /jwt/i.test(String(message ?? ''))) return 'auth'
  if (c === '' || c.startsWith('PGRST00') || TRANSIENT_SQLSTATE.test(c)) return 'transient'
  return 'permanent'
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The persisted FIFO queue of study writes. Ops are sent one at a time
 * because an attempt's session_id references its session. Every write
 * carries a client id, so re-sending after a lost response is a no-op on
 * the server (upsert ignoreDuplicates).
 */
export function createOutbox({
  api,
  storage,
  refreshAuth,
  schedule = (fn, ms) => void setTimeout(fn, ms),
  now = () => new Date(),
  onError = (error) => console.error('Outbox storage failed:', error),
}: {
  api: OutboxApi
  storage: KeyValueStorage
  refreshAuth: () => Promise<RefreshResult>
  schedule?: (fn: () => void, ms: number) => void
  now?: () => Date
  onError?: (error: unknown) => void
}): Outbox {
  let state: OutboxState = { pending: [], failed: [], paused: false }
  const listeners = new Set<() => void>()
  let failures = 0
  let retryScheduled = false

  function set(next: OutboxState) {
    state = next
    listeners.forEach((listener) => listener())
  }

  async function save() {
    try {
      await storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ pending: state.pending, failed: state.failed }),
      )
    } catch (error) {
      onError(error)
    }
  }

  async function load() {
    try {
      const raw = await storage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<OutboxState>
      set({ ...state, pending: saved.pending ?? [], failed: saved.failed ?? [] })
    } catch (error) {
      onError(error)
    }
  }

  // Every read-modify-write runs in order on one chain, starting with load.
  let tail: Promise<unknown> = load()
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task)
    tail = result.catch(() => {})
    return result
  }

  function send(op: OutboxOp): Promise<unknown> {
    switch (op.type) {
      case 'createStudySession':
        return api.studySessions.createStudySession(op.input)
      case 'completeStudySession':
        return api.studySessions.completeStudySession(op.id, op.patch)
      case 'createQuizAttempt':
        return api.quizAttempts.createQuizAttempt(op.input)
    }
  }

  function scheduleRetry() {
    failures += 1
    if (retryScheduled) return
    retryScheduled = true
    const delay = Math.min(BASE_RETRY_MS * 2 ** (failures - 1), MAX_RETRY_MS)
    schedule(() => {
      retryScheduled = false
      void flush()
    }, delay)
  }

  async function sendAll() {
    let refreshedFor: OutboxOp | null = null
    while (!state.paused && state.pending.length > 0) {
      const op = state.pending[0]
      try {
        await send(op)
      } catch (error) {
        const kind = classifyError(error)
        if (kind === 'transient') return scheduleRetry()
        if (kind === 'auth') {
          if (refreshedFor !== op) {
            const result = await refreshAuth()
            if (result === 'refreshed') {
              refreshedFor = op
              continue
            }
            if (result === 'offline') return scheduleRetry()
          }
          set({ ...state, paused: true })
          return
        }
        if (kind === 'permanent') {
          set({
            ...state,
            pending: state.pending.slice(1),
            failed: [
              ...state.failed,
              { op, error: messageOf(error), failedAt: now().toISOString() },
            ],
          })
          await save()
          continue
        }
        // 'duplicate': the server already has it.
      }
      failures = 0
      set({ ...state, pending: state.pending.slice(1) })
      await save()
    }
  }

  function flush() {
    return serial(sendAll)
  }

  return {
    enqueue: (op) =>
      serial(async () => {
        set({ ...state, pending: [...state.pending, op] })
        await save()
      }),
    flush,
    resume: () =>
      serial(async () => {
        if (state.paused) set({ ...state, paused: false })
      }),
    clear: () =>
      serial(async () => {
        const discarded = state.pending.length
        set({ pending: [], failed: [], paused: false })
        try {
          await storage.removeItem(STORAGE_KEY)
        } catch (error) {
          onError(error)
        }
        return discarded
      }),
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
```

In `classifyError`, `new TypeError('Network request failed')` has no `code`, so it's transient.

- [ ] **Step 4: Run tests and typecheck**

Run from `apps/mobile`: `bunx jest src/features/sync/outbox && bun run typecheck`
Expected: every outbox test PASSES (11 cases plus 11 classification rows). No type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/sync
git commit -m "feat(mobile): persisted outbox with per-class error handling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Study writes go through the outbox

**Files:**

- Create: `apps/mobile/src/features/study/writer.ts`
- Test: `apps/mobile/src/features/study/writer.test.ts`
- Create: `apps/mobile/src/features/sync/instances.ts`
- Modify: `apps/mobile/src/features/study/studyWriter.ts`
- Modify: `apps/mobile/src/features/study/StudyScreen.tsx` (type import only)
- Modify: `apps/mobile/src/features/study/StudyScreen.test.tsx` (type import, drop `idle`)
- Delete: `apps/mobile/src/features/study/createStudyWriter.ts`, `apps/mobile/src/features/study/createStudyWriter.test.ts`

**Interfaces:**

- Consumes: `Outbox` and `OutboxOp` (Task 3)
- Produces:
  - `type StudyWriter = { startSession(input): void; recordAttempt(input): void; completeSession(id, patch): void }` (`@/features/study/writer`)
  - `createOutboxWriter(outbox: Pick<Outbox, 'enqueue' | 'flush'>): StudyWriter`
  - `outbox`, the app instance (`@/features/sync/instances`)

- [ ] **Step 1: Write the failing test**

`apps/mobile/src/features/study/writer.test.ts`:

```ts
import type { OutboxOp } from '@/features/sync/outbox'
import { createOutboxWriter } from './writer'

function fakeOutbox() {
  const log: string[] = []
  const outbox = {
    enqueue: jest.fn(async (op: OutboxOp) => void log.push(`enqueue ${op.type} ${op.id}`)),
    flush: jest.fn(async () => void log.push('flush')),
  }
  return { outbox, log }
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

test('queues each study write as an outbox op with its client id, then sends', async () => {
  const { outbox, log } = fakeOutbox()
  const writer = createOutboxWriter(outbox)
  const session = {
    id: 'sess-1',
    started_at: '2026-10-18T10:00:00.000Z',
    study_set_id: 's1',
    mode: 'conversion' as const,
    direction: 'es_en' as const,
    visibility: null,
    deck_size: 1,
  }
  const attempt = {
    id: 'a1',
    answered_at: '2026-10-18T10:01:00.000Z',
    card_id: 'c1',
    is_correct: true,
    attempt_count: 1,
    session_id: 'sess-1',
    resolved_direction: 'es_en' as const,
  }
  const done = { completed_at: '2026-10-18T10:02:00.000Z', cards_correct: 1 }

  writer.startSession(session)
  writer.recordAttempt(attempt)
  writer.completeSession('sess-1', done)
  await flushPromises()

  expect(outbox.enqueue.mock.calls.map(([op]) => op)).toEqual([
    { type: 'createStudySession', id: 'sess-1', input: session },
    { type: 'createQuizAttempt', id: 'a1', input: attempt },
    { type: 'completeStudySession', id: 'sess-1', patch: done },
  ])
  expect(log).toEqual([
    'enqueue createStudySession sess-1',
    'enqueue createQuizAttempt a1',
    'enqueue completeStudySession sess-1',
    'flush',
    'flush',
    'flush',
  ])
})
```

- [ ] **Step 2: Run it to verify it fails**

Run from `apps/mobile`: `bunx jest src/features/study/writer`
Expected: FAIL with "Cannot find module './writer'".

- [ ] **Step 3: Write the implementation**

`apps/mobile/src/features/study/writer.ts`:

```ts
import type { QuizAttemptInput, StudySessionInput } from '@escritorio/core'
import type { Outbox, OutboxOp } from '@/features/sync/outbox'

export type StudyWriter = {
  startSession(input: StudySessionInput & { id: string; started_at: string }): void
  recordAttempt(input: QuizAttemptInput & { id: string; answered_at: string }): void
  completeSession(id: string, patch: { completed_at: string; cards_correct: number }): void
}

/**
 * Study writes, queued in the persisted outbox so they survive being
 * offline or the app closing, then sent straight away when possible.
 */
export function createOutboxWriter(outbox: Pick<Outbox, 'enqueue' | 'flush'>): StudyWriter {
  function queue(op: OutboxOp) {
    void outbox.enqueue(op).then(() => outbox.flush())
  }
  return {
    startSession: (input) => queue({ type: 'createStudySession', id: input.id, input }),
    recordAttempt: (input) => queue({ type: 'createQuizAttempt', id: input.id, input }),
    completeSession: (id, patch) => queue({ type: 'completeStudySession', id, patch }),
  }
}
```

The test's expected log shows all three enqueues before any flush. Each `enqueue` resolves on a later microtask than the synchronous calls that follow it, so all three are queued first.

`apps/mobile/src/features/sync/instances.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { createOutbox, type RefreshResult } from './outbox'

// The app's single instances of the offline machinery. Modules that need
// them import from here; tests build their own with fakes.

async function refreshAuth(): Promise<RefreshResult> {
  const { error } = await supabase.auth.refreshSession()
  if (!error) return 'refreshed'
  return isAuthRetryableFetchError(error) ? 'offline' : 'rejected'
}

export const outbox = createOutbox({ api, storage: AsyncStorage, refreshAuth })
```

Replace `apps/mobile/src/features/study/studyWriter.ts` with:

```ts
import { outbox } from '@/features/sync/instances'
import { createOutboxWriter } from './writer'

export const studyWriter = createOutboxWriter(outbox)
```

Delete the in-memory writer:

```bash
git rm apps/mobile/src/features/study/createStudyWriter.ts apps/mobile/src/features/study/createStudyWriter.test.ts
```

In `StudyScreen.tsx` and `StudyScreen.test.tsx`, replace `import type { StudyWriter } from './createStudyWriter'` with `import type { StudyWriter } from './writer'`. In `StudyScreen.test.tsx`'s `fakeWriter`, delete the line `idle: jest.fn(() => Promise.resolve()),`.

- [ ] **Step 4: Run tests and typecheck**

Run from `apps/mobile`: `bunx jest src/features/study && bun run typecheck`
Expected:

- every study test PASSES, including the new writer test
- no type errors
- `isAuthRetryableFetchError` resolves from `@supabase/supabase-js`

If `isAuthRetryableFetchError` isn't exported from `@supabase/supabase-js`, import it from `@supabase/auth-js` and add that as a dependency at the version supabase-js uses. Ledger that as a ruling.

- [ ] **Step 5: Commit**

```bash
git add -A apps/mobile/src/features/study apps/mobile/src/features/sync/instances.ts
git commit -m "feat(mobile): send study writes through the persisted outbox

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The image store

**Files:**

- Modify: `apps/mobile/package.json`, `bun.lock` (via `bunx expo install expo-file-system`)
- Create: `apps/mobile/src/features/sync/imageStore.ts`
- Create: `apps/mobile/src/features/sync/imageFiles.ts` (the `expo-file-system` adapter)
- Create: `apps/mobile/src/features/sync/useLocalImageUri.ts`
- Modify: `apps/mobile/src/features/sync/instances.ts` (add `imageStore`)
- Test: `apps/mobile/src/features/sync/imageStore.test.ts`

**Interfaces:**

- Consumes: `KeyValueStorage` (Task 3), and `api.cardImages.listImageVersions` (Task 1) / `getSignedImageUrls`
- Produces:
  - `planImageSync(wanted: Iterable<string>, remote: Record<string, string>, manifest: Manifest): { download: string[]; remove: string[] }`
  - `fileNameFor(path: string, updatedAt: string): string`
  - `type ImageFiles = { download(url, name): Promise<void>; remove(name): void; list(): string[]; uriFor(name): string; removeAll(): void }`
  - `createImageStore(deps): ImageStore`, where `ImageStore = { load(): Promise<void>; sync(wanted: Iterable<string>, ownerId: string | null): Promise<void>; uriFor(path: string | null): string | null; subscribe(listener): () => void; clear(): Promise<void> }`
  - `imageStore`, the app instance (`@/features/sync/instances`)
  - `useLocalImageUri(path: string | null): string | null` (`@/features/sync/useLocalImageUri`)

- [ ] **Step 1: Install `expo-file-system`**

Run from `apps/mobile`: `bunx expo install expo-file-system`
Expected: `package.json` gains `"expo-file-system": "~58.x.x"`. It's already present as Expo's own dependency, so this only declares it.

- [ ] **Step 2: Write the failing test**

`apps/mobile/src/features/sync/imageStore.test.ts`:

```ts
import { createImageStore, fileNameFor, planImageSync, type ImageFiles } from './imageStore'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => void data.set(key, value),
    removeItem: async (key: string) => void data.delete(key),
  }
}

function fakeFiles(failFor: string[] = []) {
  const names = new Set<string>()
  let inFlight = 0
  let maxInFlight = 0
  const files: ImageFiles = {
    async download(url, name) {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 0))
      inFlight -= 1
      if (failFor.some((p) => url.includes(p))) throw new Error('download failed')
      names.add(name)
    },
    remove: (name) => void names.delete(name),
    list: () => [...names],
    uriFor: (name) => `file:///images/${name}`,
    removeAll: () => names.clear(),
  }
  return { files, names, maxInFlight: () => maxInFlight }
}

function fakeApi(versions: Record<string, string>) {
  return {
    listImageVersions: jest.fn(async () => versions),
    getSignedImageUrls: jest.fn(async (paths: string[]) =>
      Object.fromEntries(paths.map((p) => [p, `https://cdn.test/${p}`])),
    ),
  }
}

const T1 = '2026-10-01T00:00:00.000Z'
const T2 = '2026-10-05T00:00:00.000Z'

describe('planImageSync', () => {
  const manifest = {
    'u/a.png': { updatedAt: T1, file: 'a' },
    'u/b.png': { updatedAt: T1, file: 'b' },
    'u/old.png': { updatedAt: T1, file: 'old' },
  }
  const remote = { 'u/a.png': T1, 'u/b.png': T2, 'u/new.png': T1, 'u/old.png': T1 }

  it('downloads missing and changed images, removes unwanted ones', () => {
    expect(
      planImageSync(['u/a.png', 'u/b.png', 'u/new.png', 'u/gone.png'], remote, manifest),
    ).toEqual({
      download: ['u/b.png', 'u/new.png'],
      remove: ['u/old.png'],
    })
  })
})

test('a new file name per version, keeping the extension', () => {
  expect(fileNameFor('u1/sets/s1.png', T2)).toBe(`u1_sets_s1-${Date.parse(T2)}.png`)
})

test('mirrors wanted images, four downloads at a time, and serves local URIs', async () => {
  const paths = Array.from({ length: 10 }, (_, i) => `u1/c${i}.png`)
  const { files, maxInFlight } = fakeFiles()
  const api = fakeApi(Object.fromEntries(paths.map((p) => [p, T1])))
  const store = createImageStore({ files, api, storage: memoryStorage() })

  await store.sync(paths, 'u1')

  expect(api.listImageVersions).toHaveBeenCalledWith('u1')
  expect(api.getSignedImageUrls).toHaveBeenCalledTimes(1)
  expect(maxInFlight()).toBe(4)
  expect(store.uriFor('u1/c3.png')).toBe(`file:///images/${fileNameFor('u1/c3.png', T1)}`)
})

test('a replaced image is downloaded under a new name and the old file is deleted', async () => {
  const { files, names } = fakeFiles()
  const storage = memoryStorage()
  await createImageStore({ files, api: fakeApi({ 'u1/c1.png': T1 }), storage }).sync(
    ['u1/c1.png'],
    'u1',
  )

  const store = createImageStore({ files, api: fakeApi({ 'u1/c1.png': T2 }), storage })
  await store.load()
  await store.sync(['u1/c1.png'], 'u1')

  expect([...names]).toEqual([fileNameFor('u1/c1.png', T2)])
  expect(store.uriFor('u1/c1.png')).toContain(String(Date.parse(T2)))
})

test('images no longer wanted are deleted, and unchanged ones are left alone', async () => {
  const { files, names } = fakeFiles()
  const storage = memoryStorage()
  const api = fakeApi({ 'u1/a.png': T1, 'u1/b.png': T1 })
  const store = createImageStore({ files, api, storage })
  await store.sync(['u1/a.png', 'u1/b.png'], 'u1')

  await store.sync(['u1/a.png'], 'u1')

  expect([...names]).toEqual([fileNameFor('u1/a.png', T1)])
  expect(store.uriFor('u1/b.png')).toBeNull()
  expect(api.getSignedImageUrls).toHaveBeenCalledTimes(1)
})

test('a failed download shows no image, the others still land, and it is retried next sync', async () => {
  const { files } = fakeFiles(['u1/bad.png'])
  const api = fakeApi({ 'u1/bad.png': T1, 'u1/good.png': T1 })
  const store = createImageStore({ files, api, storage: memoryStorage(), onError: jest.fn() })

  await store.sync(['u1/bad.png', 'u1/good.png'], 'u1')
  expect(store.uriFor('u1/bad.png')).toBeNull()
  expect(store.uriFor('u1/good.png')).not.toBeNull()

  await store.sync(['u1/bad.png', 'u1/good.png'], 'u1')
  expect(api.getSignedImageUrls).toHaveBeenLastCalledWith(['u1/bad.png'])
})

test('with no sets there is no owner: nothing is listed and old files are removed', async () => {
  const { files, names } = fakeFiles()
  const storage = memoryStorage()
  await createImageStore({ files, api: fakeApi({ 'u1/a.png': T1 }), storage }).sync(
    ['u1/a.png'],
    'u1',
  )
  const api = fakeApi({})
  const store = createImageStore({ files, api, storage })
  await store.load()

  await store.sync([], null)

  expect(api.listImageVersions).not.toHaveBeenCalled()
  expect(names.size).toBe(0)
})

test('files left over from an interrupted sync are cleaned up', async () => {
  const { files, names } = fakeFiles()
  names.add('stray-123.png')
  const store = createImageStore({ files, api: fakeApi({}), storage: memoryStorage() })
  await store.sync([], 'u1')
  expect(names.has('stray-123.png')).toBe(false)
})

test('clear deletes every file and forgets the manifest', async () => {
  const { files, names } = fakeFiles()
  const storage = memoryStorage()
  const store = createImageStore({ files, api: fakeApi({ 'u1/a.png': T1 }), storage })
  await store.sync(['u1/a.png'], 'u1')

  await store.clear()

  expect(names.size).toBe(0)
  expect(store.uriFor('u1/a.png')).toBeNull()
  expect(storage.data.size).toBe(0)
})

test('subscribers hear about each downloaded image', async () => {
  const { files } = fakeFiles()
  const store = createImageStore({
    files,
    api: fakeApi({ 'u1/a.png': T1, 'u1/b.png': T1 }),
    storage: memoryStorage(),
  })
  const listener = jest.fn()
  store.subscribe(listener)
  await store.sync(['u1/a.png', 'u1/b.png'], 'u1')
  expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2)
})
```

- [ ] **Step 3: Run it to verify it fails**

Run from `apps/mobile`: `bunx jest src/features/sync/imageStore`
Expected: FAIL with "Cannot find module './imageStore'".

- [ ] **Step 4: Write the implementation**

`apps/mobile/src/features/sync/imageStore.ts`:

```ts
import type { Api } from '@escritorio/core'
import type { KeyValueStorage } from './outbox'

export type ManifestEntry = { updatedAt: string; file: string }
export type Manifest = Record<string, ManifestEntry>

/** The images folder, behind an interface so the store is testable without native code. */
export type ImageFiles = {
  download(url: string, name: string): Promise<void>
  remove(name: string): void
  list(): string[]
  uriFor(name: string): string
  removeAll(): void
}

export type ImageStore = {
  load(): Promise<void>
  sync(wanted: Iterable<string>, ownerId: string | null): Promise<void>
  uriFor(path: string | null): string | null
  subscribe(listener: () => void): () => void
  clear(): Promise<void>
}

const MANIFEST_KEY = 'escritorio-image-manifest'

/** What to fetch (missing locally, or a different version remotely) and what to delete. */
export function planImageSync(
  wanted: Iterable<string>,
  remote: Record<string, string>,
  manifest: Manifest,
): { download: string[]; remove: string[] } {
  const want = new Set(wanted)
  return {
    download: [...want].filter(
      (path) => remote[path] && manifest[path]?.updatedAt !== remote[path],
    ),
    remove: Object.keys(manifest).filter((path) => !want.has(path)),
  }
}

/** One name per version: a replaced image gets a new URI, so no image cache can show the old one. */
export function fileNameFor(path: string, updatedAt: string): string {
  const slash = path.lastIndexOf('/')
  const dot = path.lastIndexOf('.')
  const hasExtension = dot > slash
  const base = (hasExtension ? path.slice(0, dot) : path).replace(/[^A-Za-z0-9_-]/g, '_')
  return `${base}-${Date.parse(updatedAt)}${hasExtension ? path.slice(dot) : ''}`
}

async function forEachLimit<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await task(items[next++])
  })
  await Promise.all(workers)
}

/**
 * The on-device mirror of every image the user's sets use. Screens read
 * local file:// URIs from it and never fetch images over the network.
 */
export function createImageStore({
  files,
  api,
  storage,
  concurrency = 4,
  onError = (error) => console.warn('Image sync:', error),
}: {
  files: ImageFiles
  api: Pick<Api['cardImages'], 'listImageVersions' | 'getSignedImageUrls'>
  storage: KeyValueStorage
  concurrency?: number
  onError?: (error: unknown) => void
}): ImageStore {
  let manifest: Manifest = {}
  const listeners = new Set<() => void>()

  function set(next: Manifest) {
    manifest = next
    listeners.forEach((listener) => listener())
  }

  function removeFile(name: string) {
    try {
      files.remove(name)
    } catch (error) {
      onError(error)
    }
  }

  async function save() {
    try {
      await storage.setItem(MANIFEST_KEY, JSON.stringify(manifest))
    } catch (error) {
      onError(error)
    }
  }

  return {
    async load() {
      try {
        const raw = await storage.getItem(MANIFEST_KEY)
        if (raw) set(JSON.parse(raw) as Manifest)
      } catch (error) {
        onError(error)
      }
    },

    async sync(wanted, ownerId) {
      const remote = ownerId ? await api.listImageVersions(ownerId) : {}
      const { download, remove } = planImageSync(wanted, remote, manifest)

      if (remove.length > 0) {
        const next = { ...manifest }
        for (const path of remove) {
          removeFile(next[path].file)
          delete next[path]
        }
        set(next)
      }

      if (download.length > 0) {
        const urls = await api.getSignedImageUrls(download)
        await forEachLimit(download, concurrency, async (path) => {
          const url = urls[path]
          if (!url) return
          const name = fileNameFor(path, remote[path])
          try {
            await files.download(url, name)
          } catch (error) {
            // Placeholder for now; the next sync tries again.
            onError(error)
            return
          }
          const previous = manifest[path]
          set({ ...manifest, [path]: { updatedAt: remote[path], file: name } })
          if (previous && previous.file !== name) removeFile(previous.file)
        })
      }

      // Anything the manifest doesn't name (an interrupted download) goes.
      const keep = new Set(Object.values(manifest).map((entry) => entry.file))
      for (const name of files.list()) if (!keep.has(name)) removeFile(name)

      await save()
    },

    uriFor(path) {
      const entry = path ? manifest[path] : undefined
      return entry ? files.uriFor(entry.file) : null
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async clear() {
      try {
        files.removeAll()
      } catch (error) {
        onError(error)
      }
      set({})
      await storage.removeItem(MANIFEST_KEY)
    },
  }
}
```

`apps/mobile/src/features/sync/imageFiles.ts`:

```ts
import { Directory, File, Paths } from 'expo-file-system'
import type { ImageFiles } from './imageStore'

// documentDirectory, not the cache directory: iOS may empty the cache when
// the phone needs space, and these files are what offline study shows.
const folder = new Directory(Paths.document, 'images')

export const imageFiles: ImageFiles = {
  async download(url, name) {
    folder.create({ intermediates: true, idempotent: true })
    await File.downloadFileAsync(url, new File(folder, name), { idempotent: true })
  },
  remove(name) {
    const file = new File(folder, name)
    if (file.exists) file.delete()
  },
  list() {
    return folder.exists ? folder.list().map((entry) => entry.name) : []
  },
  uriFor(name) {
    return new File(folder, name).uri
  },
  removeAll() {
    if (folder.exists) folder.delete()
  },
}
```

Typecheck checks the `Directory.create` options and `File.downloadFileAsync` signature against `node_modules/expo-file-system/build/*.d.ts`. If an option name differs, use the one the types declare and ledger it.

`apps/mobile/src/features/sync/useLocalImageUri.ts`:

```ts
import { useCallback, useSyncExternalStore } from 'react'
import { imageStore } from './instances'

/** The on-device file:// URI for a storage path, or null until it has been downloaded. */
export function useLocalImageUri(path: string | null): string | null {
  const getSnapshot = useCallback(() => imageStore.uriFor(path), [path])
  return useSyncExternalStore(imageStore.subscribe, getSnapshot)
}
```

In `apps/mobile/src/features/sync/instances.ts`, add the imports:

```ts
import { imageFiles } from './imageFiles'
import { createImageStore } from './imageStore'
```

and at the end:

```ts
export const imageStore = createImageStore({
  files: imageFiles,
  api: api.cardImages,
  storage: AsyncStorage,
})
```

- [ ] **Step 5: Run tests and typecheck**

Run from `apps/mobile`: `bunx jest src/features/sync && bun run typecheck`
Expected: every sync test PASSES (10 new image store tests) and there are no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/package.json bun.lock apps/mobile/src/features/sync
git commit -m "feat(mobile): mirror set and card images on the device

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Sync engine, cache refresh and status line

**Files:**

- Create: `apps/mobile/src/features/sync/syncEngine.ts`
- Create: `apps/mobile/src/features/sync/applySyncedData.ts`
- Create: `apps/mobile/src/features/sync/statusLine.ts`
- Modify: `apps/mobile/src/features/sync/instances.ts` (add `syncEngine`)
- Test: `apps/mobile/src/features/sync/syncEngine.test.ts`, `apps/mobile/src/features/sync/applySyncedData.test.ts`, `apps/mobile/src/features/sync/statusLine.test.ts`

**Interfaces:**

- Consumes: `outbox` and `imageStore` (Tasks 3–5), `api.cards.listAllCards` (Task 1), `queryClient` (Task 2), and `KeyValueStorage`
- Produces:
  - `type SyncedData = { sets: StudySetSummary[]; cards: Card[] }`
  - `createSyncEngine(deps): SyncEngine`, where `SyncEngine = { load(): Promise<void>; requestSync(): Promise<void>; getStatus(): SyncStatus; subscribe(listener): () => void; clear(): Promise<void> }` and `SyncStatus = { syncing: boolean; lastSyncedAt: string | null; failed: boolean }`
  - `applySyncedData(client: QueryClient, data: SyncedData): void`
  - `wantedImagePaths(data: SyncedData): string[]`
  - `statusLine(input: { online: boolean; syncing: boolean; failed: boolean; lastSyncedAt: string | null; pendingAnswers: number; now: Date }): string`
  - `syncEngine`, the app instance (`@/features/sync/instances`)

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/features/sync/syncEngine.test.ts`:

```ts
import { createSyncEngine, type SyncedData } from './syncEngine'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => void data.set(key, value),
    removeItem: async (key: string) => void data.delete(key),
  }
}

const DATA: SyncedData = { sets: [], cards: [] }

function setup({ online = true } = {}) {
  const log: string[] = []
  let release: () => void = () => {}
  const deps = {
    isOnline: jest.fn(() => online),
    flushOutbox: jest.fn(async () => void log.push('outbox')),
    fetchData: jest.fn(async () => {
      log.push('fetch')
      return DATA
    }),
    applyData: jest.fn(() => void log.push('apply')),
    syncImages: jest.fn(async () => void log.push('images')),
    storage: memoryStorage(),
    now: () => new Date('2026-10-18T12:00:00.000Z'),
    onError: jest.fn(),
  }
  const gate = () =>
    new Promise<void>((resolve) => {
      release = resolve
    })
  return { engine: createSyncEngine(deps), deps, log, gate, release: () => release() }
}

test('a run sends the outbox, then refreshes data, then images', async () => {
  const { engine, log, deps } = setup()
  await engine.requestSync()
  expect(log).toEqual(['outbox', 'fetch', 'apply', 'images'])
  expect(deps.applyData).toHaveBeenCalledWith(DATA)
  expect(deps.syncImages).toHaveBeenCalledWith(DATA)
  expect(engine.getStatus()).toEqual({
    syncing: false,
    lastSyncedAt: '2026-10-18T12:00:00.000Z',
    failed: false,
  })
})

test('offline, a sync does nothing', async () => {
  const { engine, log } = setup({ online: false })
  await engine.requestSync()
  expect(log).toEqual([])
})

test('triggers during a run merge into one follow-up run', async () => {
  const { engine, deps, gate, release } = setup()
  deps.flushOutbox.mockImplementationOnce(gate)

  const first = engine.requestSync()
  expect(engine.getStatus().syncing).toBe(true)
  const second = engine.requestSync()
  const third = engine.requestSync()
  expect(second).toBe(third)

  release()
  await Promise.all([first, second, third])
  expect(deps.fetchData).toHaveBeenCalledTimes(2)
})

test('a failed run keeps the last sync time and reports the failure', async () => {
  const { engine, deps } = setup()
  await engine.requestSync()
  deps.fetchData.mockRejectedValueOnce(new Error('offline'))

  await engine.requestSync()

  expect(engine.getStatus()).toEqual({
    syncing: false,
    lastSyncedAt: '2026-10-18T12:00:00.000Z',
    failed: true,
  })
  expect(deps.onError).toHaveBeenCalled()
})

test('the last sync time survives a restart, and clear forgets it', async () => {
  const { engine, deps } = setup()
  await engine.requestSync()

  const relaunched = createSyncEngine(deps)
  await relaunched.load()
  expect(relaunched.getStatus().lastSyncedAt).toBe('2026-10-18T12:00:00.000Z')

  await relaunched.clear()
  expect(relaunched.getStatus().lastSyncedAt).toBeNull()
  expect(deps.storage.data.size).toBe(0)
})
```

`apps/mobile/src/features/sync/applySyncedData.test.ts`:

```ts
import { queryKeys, type StudySetSummary } from '@escritorio/core'
import { QueryClient } from '@tanstack/react-query'
import { makeCard, makeStudySet } from '@/test/fixtures'
import { applySyncedData, wantedImagePaths } from './applySyncedData'

const summary = (id: string, image_path: string | null = null): StudySetSummary => ({
  ...makeStudySet({ id, image_path }),
  fallback_image_paths: [],
})

test('writes every set and its cards into the cache, and drops deleted sets', () => {
  const client = new QueryClient()
  client.setQueryData(queryKeys.studySet('gone'), makeStudySet({ id: 'gone' }))
  client.setQueryData(queryKeys.cards('gone'), [])
  const a = makeCard({ id: 'c1', study_set_id: 's1', position: 0 })
  const b = makeCard({ id: 'c2', study_set_id: 's1', position: 1 })

  applySyncedData(client, { sets: [summary('s1'), summary('s2')], cards: [a, b] })

  expect(client.getQueryData(queryKeys.studySets())).toHaveLength(2)
  expect(client.getQueryData(queryKeys.studySet('s1'))).toEqual(makeStudySet({ id: 's1' }))
  expect(client.getQueryData(queryKeys.cards('s1'))).toEqual([a, b])
  expect(client.getQueryData(queryKeys.cards('s2'))).toEqual([])
  expect(client.getQueryData(queryKeys.studySet('gone'))).toBeUndefined()
  expect(client.getQueryData(queryKeys.cards('gone'))).toBeUndefined()
})

test('wants every card image and set cover', () => {
  expect(
    wantedImagePaths({
      sets: [summary('s1', 'u/sets/s1.png'), summary('s2')],
      cards: [makeCard({ image_path: 'u/c1.png' }), makeCard({ id: 'c2', image_path: null })],
    }),
  ).toEqual(['u/c1.png', 'u/sets/s1.png'])
})
```

`apps/mobile/src/features/sync/statusLine.test.ts`:

```ts
import { statusLine } from './statusLine'

const now = new Date('2026-10-18T12:00:00.000Z')
const base = {
  online: true,
  syncing: false,
  failed: false,
  lastSyncedAt: '2026-10-18T11:58:00.000Z',
  pendingAnswers: 0,
  now,
}

test.each([
  [{ online: false }, 'Offline'],
  [{ online: false, pendingAnswers: 3 }, 'Offline · 3 answers waiting to sync'],
  [{ online: false, pendingAnswers: 1 }, 'Offline · 1 answer waiting to sync'],
  [{ syncing: true, pendingAnswers: 2 }, 'Syncing…'],
  [{ pendingAnswers: 2 }, '2 answers waiting to sync'],
  [{ failed: true }, "Couldn't sync. Pull down to try again."],
  [{ lastSyncedAt: '2026-10-18T11:59:40.000Z' }, 'Synced just now'],
  [{}, 'Synced 2 min ago'],
  [{ lastSyncedAt: '2026-10-18T09:00:00.000Z' }, 'Synced 3 h ago'],
  [{ lastSyncedAt: '2026-10-15T12:00:00.000Z' }, 'Synced 3 days ago'],
  [{ lastSyncedAt: '2026-10-17T11:00:00.000Z' }, 'Synced 1 day ago'],
  [{ lastSyncedAt: null }, 'Not synced yet'],
])('%o → %s', (overrides, expected) => {
  expect(statusLine({ ...base, ...overrides })).toBe(expected)
})
```

- [ ] **Step 2: Run them to verify they fail**

Run from `apps/mobile`: `bunx jest src/features/sync/syncEngine src/features/sync/applySyncedData src/features/sync/statusLine`
Expected: FAIL with "Cannot find module" for each of the three.

- [ ] **Step 3: Write the implementation**

`apps/mobile/src/features/sync/syncEngine.ts`:

```ts
import type { Card, StudySetSummary } from '@escritorio/core'
import type { KeyValueStorage } from './outbox'

export type SyncedData = { sets: StudySetSummary[]; cards: Card[] }
export type SyncStatus = { syncing: boolean; lastSyncedAt: string | null; failed: boolean }

export type SyncEngine = {
  load(): Promise<void>
  /** Starts a run, or (during one) a single follow-up run shared by every caller. */
  requestSync(): Promise<void>
  getStatus(): SyncStatus
  subscribe(listener: () => void): () => void
  clear(): Promise<void>
}

const LAST_SYNCED_KEY = 'escritorio-last-synced-at'

export function createSyncEngine({
  isOnline,
  flushOutbox,
  fetchData,
  applyData,
  syncImages,
  storage,
  now = () => new Date(),
  onError = (error) => console.warn('Sync failed:', error),
}: {
  isOnline: () => boolean
  flushOutbox: () => Promise<void>
  fetchData: () => Promise<SyncedData>
  applyData: (data: SyncedData) => void
  syncImages: (data: SyncedData) => Promise<void>
  storage: KeyValueStorage
  now?: () => Date
  onError?: (error: unknown) => void
}): SyncEngine {
  let status: SyncStatus = { syncing: false, lastSyncedAt: null, failed: false }
  const listeners = new Set<() => void>()

  function set(patch: Partial<SyncStatus>) {
    status = { ...status, ...patch }
    listeners.forEach((listener) => listener())
  }

  // The order matters: the server gets our writes before we read, so the
  // fresh data already reflects them.
  async function run() {
    if (!isOnline()) return
    set({ syncing: true })
    try {
      await flushOutbox()
      const data = await fetchData()
      applyData(data)
      await syncImages(data)
      const at = now().toISOString()
      set({ lastSyncedAt: at, failed: false })
      await storage.setItem(LAST_SYNCED_KEY, at)
    } catch (error) {
      onError(error)
      set({ failed: true })
    } finally {
      set({ syncing: false })
    }
  }

  let running: Promise<void> | null = null
  let followUp: Promise<void> | null = null

  function requestSync(): Promise<void> {
    if (!running) {
      running = run().finally(() => {
        running = null
      })
      return running
    }
    followUp ??= running.then(() => {
      followUp = null
      return requestSync()
    })
    return followUp
  }

  return {
    async load() {
      try {
        set({ lastSyncedAt: await storage.getItem(LAST_SYNCED_KEY) })
      } catch (error) {
        onError(error)
      }
    },
    requestSync,
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async clear() {
      set({ lastSyncedAt: null, failed: false })
      await storage.removeItem(LAST_SYNCED_KEY)
    },
  }
}
```

`apps/mobile/src/features/sync/applySyncedData.ts`:

```ts
import { queryKeys, type Card } from '@escritorio/core'
import type { QueryClient } from '@tanstack/react-query'
import type { SyncedData } from './syncEngine'

const STUDY_SET_KEY = queryKeys.studySet('')[0]
const CARDS_KEY = queryKeys.cards('')[0]

/** Replaces the cached sets and cards with a fresh copy; sets deleted on the server disappear. */
export function applySyncedData(client: QueryClient, { sets, cards }: SyncedData): void {
  client.setQueryData(queryKeys.studySets(), sets)

  const cardsBySet = new Map<string, Card[]>(sets.map((set) => [set.id, []]))
  for (const card of cards) cardsBySet.get(card.study_set_id)?.push(card)

  for (const { fallback_image_paths: _fallbacks, ...studySet } of sets) {
    client.setQueryData(queryKeys.studySet(studySet.id), studySet)
    client.setQueryData(queryKeys.cards(studySet.id), cardsBySet.get(studySet.id))
  }

  const live = new Set(sets.map((set) => set.id))
  client.removeQueries({
    predicate: ({ queryKey: [key, id] }) =>
      (key === STUDY_SET_KEY || key === CARDS_KEY) && typeof id === 'string' && !live.has(id),
  })
}

export function wantedImagePaths({ sets, cards }: SyncedData): string[] {
  return [...cards.map((card) => card.image_path), ...sets.map((set) => set.image_path)].filter(
    (path): path is string => path != null,
  )
}
```

`apps/mobile/src/features/sync/statusLine.ts`:

```ts
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function ago(at: string, now: Date): string {
  const elapsed = now.getTime() - Date.parse(at)
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`
  return `${plural(Math.floor(elapsed / DAY), 'day')} ago`
}

/** The one-line sync summary at the top of the set list. */
export function statusLine({
  online,
  syncing,
  failed,
  lastSyncedAt,
  pendingAnswers,
  now,
}: {
  online: boolean
  syncing: boolean
  failed: boolean
  lastSyncedAt: string | null
  pendingAnswers: number
  now: Date
}): string {
  const waiting = `${plural(pendingAnswers, 'answer')} waiting to sync`
  if (!online) return pendingAnswers > 0 ? `Offline · ${waiting}` : 'Offline'
  if (syncing) return 'Syncing…'
  if (pendingAnswers > 0) return waiting
  if (failed) return "Couldn't sync. Pull down to try again."
  if (!lastSyncedAt) return 'Not synced yet'
  return `Synced ${ago(lastSyncedAt, now)}`
}
```

In `apps/mobile/src/features/sync/instances.ts`, add the imports:

```ts
import { onlineManager } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { applySyncedData, wantedImagePaths } from './applySyncedData'
import { createSyncEngine } from './syncEngine'
```

and at the end:

```ts
export const syncEngine = createSyncEngine({
  isOnline: () => onlineManager.isOnline(),
  flushOutbox: () => outbox.flush(),
  fetchData: async () => {
    const [sets, cards] = await Promise.all([
      api.studySets.listStudySets(),
      api.cards.listAllCards(),
    ])
    return { sets, cards }
  },
  applyData: (data) => applySyncedData(queryClient, data),
  // Every set has the same owner: the signed-in user (RLS).
  syncImages: (data) => imageStore.sync(wantedImagePaths(data), data.sets[0]?.owner_id ?? null),
  storage: AsyncStorage,
})
```

- [ ] **Step 4: Run tests and typecheck**

Run from `apps/mobile`: `bunx jest src/features/sync && bun run typecheck`
Expected: every sync test PASSES, and there are no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/sync
git commit -m "feat(mobile): sync engine that refreshes the cache and images, with a status line

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Wire it in: triggers, local images, status line, sign-out and account switch

**Files:**

- Create: `apps/mobile/src/features/sync/localData.ts`
- Create: `apps/mobile/src/features/sync/SyncProvider.tsx`
- Create: `apps/mobile/src/features/sync/confirmSignOut.ts`
- Create: `apps/mobile/src/features/sync/useSyncStatusLine.ts`
- Modify: `apps/mobile/src/app/(app)/_layout.tsx`, `apps/mobile/src/app/(app)/index.tsx`, `apps/mobile/src/app/_layout.tsx`
- Modify: `apps/mobile/src/features/sets/hooks.ts`, `SetListScreen.tsx`, `SetDetailScreen.tsx`
- Modify: `apps/mobile/src/features/study/StudyScreen.tsx`, `QuizCard.tsx`
- Modify: `docs/superpowers/specs/2026-10-13-ios-app-design.md` (record the verified items)
- Test: `apps/mobile/src/features/sync/localData.test.ts`, `SyncProvider.test.tsx`, `confirmSignOut.test.ts`
- Test (update): `apps/mobile/src/features/sets/SetListScreen.test.tsx`, `SetDetailScreen.test.tsx`, `apps/mobile/src/features/study/StudyScreen.test.tsx`, `QuizCard.test.tsx`

**Interfaces:**

- Consumes: `outbox`, `imageStore`, `syncEngine`, `queryClient` (Tasks 2–6), `statusLine` (Task 6), and `useLocalImageUri` (Task 5)
- Produces:
  - `createLocalData(deps): { claim(userId: string): Promise<{ discarded: number }>; wipe(): Promise<number> }`, plus the app instance `localData`
  - `<SyncProvider userId={string} deps={SyncDeps}>`, which renders nothing until local data is claimed and loaded
  - `createConfirmSignOut(deps): () => void`
  - `useSyncStatusLine(): string`
  - `<SetListScreen onOpenSet onSignOut status={string} onRefresh={() => Promise<void>} />`

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/features/sync/localData.test.ts`:

```ts
import { createLocalData } from './localData'

function setup(owner: string | null) {
  const data = new Map<string, string>(owner ? [['escritorio-local-owner', owner]] : [])
  const deps = {
    storage: {
      getItem: async (key: string) => data.get(key) ?? null,
      setItem: async (key: string, value: string) => void data.set(key, value),
      removeItem: async (key: string) => void data.delete(key),
    },
    clearCache: jest.fn(),
    clearImages: jest.fn(async () => {}),
    clearOutbox: jest.fn(async () => 2),
    clearSyncStatus: jest.fn(async () => {}),
  }
  return { localData: createLocalData(deps), deps, data }
}

test('the same user signing back in keeps everything, including queued results', async () => {
  const { localData, deps } = setup('u1')
  expect(await localData.claim('u1')).toEqual({ discarded: 0 })
  expect(deps.clearOutbox).not.toHaveBeenCalled()
  expect(deps.clearCache).not.toHaveBeenCalled()
})

test("a different user signing in wipes the previous user's data first", async () => {
  const { localData, deps, data } = setup('u1')
  expect(await localData.claim('u2')).toEqual({ discarded: 2 })
  expect(deps.clearCache).toHaveBeenCalled()
  expect(deps.clearImages).toHaveBeenCalled()
  expect(deps.clearOutbox).toHaveBeenCalled()
  expect(deps.clearSyncStatus).toHaveBeenCalled()
  expect(data.get('escritorio-local-owner')).toBe('u2')
})

test('the first sign-in on this phone just records the owner', async () => {
  const { localData, deps, data } = setup(null)
  expect(await localData.claim('u1')).toEqual({ discarded: 0 })
  expect(deps.clearOutbox).not.toHaveBeenCalled()
  expect(data.get('escritorio-local-owner')).toBe('u1')
})

test('wipe clears everything and forgets the owner', async () => {
  const { localData, deps, data } = setup('u1')
  expect(await localData.wipe()).toBe(2)
  expect(deps.clearCache).toHaveBeenCalled()
  expect(data.has('escritorio-local-owner')).toBe(false)
})
```

`apps/mobile/src/features/sync/SyncProvider.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { SyncProvider, type SyncDeps } from './SyncProvider'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function fakeDeps(claim: Promise<{ discarded: number }> = Promise.resolve({ discarded: 0 })) {
  let appStateListener: (state: string) => void = () => {}
  let onlineListener: (online: boolean) => void = () => {}
  const deps: SyncDeps = {
    claimLocalData: jest.fn(() => claim),
    load: jest.fn(async () => {}),
    resumeOutbox: jest.fn(async () => {}),
    requestSync: jest.fn(async () => {}),
    appState: {
      addEventListener: (_event, listener) => {
        appStateListener = listener
        return { remove: () => {} }
      },
    },
    subscribeOnline: (listener) => {
      onlineListener = listener
      return () => {}
    },
    alert: jest.fn(),
  }
  return {
    deps,
    foreground: () => appStateListener('active'),
    background: () => appStateListener('background'),
    setOnline: (online: boolean) => onlineListener(online),
  }
}

test('renders nothing until this user owns the local data, then syncs', async () => {
  const claim = deferred<{ discarded: number }>()
  const { deps } = fakeDeps(claim.promise)
  await render(
    <SyncProvider userId="u1" deps={deps}>
      <Text>Sets</Text>
    </SyncProvider>,
  )
  expect(screen.queryByText('Sets')).not.toBeOnTheScreen()
  expect(deps.claimLocalData).toHaveBeenCalledWith('u1')

  await act(async () => claim.resolve({ discarded: 0 }))

  expect(screen.getByText('Sets')).toBeOnTheScreen()
  expect(deps.load).toHaveBeenCalled()
  expect(deps.resumeOutbox).toHaveBeenCalled()
  expect(deps.requestSync).toHaveBeenCalledTimes(1)
  expect(deps.alert).not.toHaveBeenCalled()
})

test("warns when the previous account's unsynced results were discarded", async () => {
  const { deps } = fakeDeps(Promise.resolve({ discarded: 3 }))
  await render(
    <SyncProvider userId="u2" deps={deps}>
      <Text>Sets</Text>
    </SyncProvider>,
  )
  await screen.findByText('Sets')
  expect(deps.alert).toHaveBeenCalledWith(
    'Unsynced results removed',
    "3 study results from the account that was signed in before hadn't synced. They were removed from this phone.",
  )
})

test('syncs when the app returns to the foreground and when the connection comes back', async () => {
  const { deps, foreground, background, setOnline } = fakeDeps()
  await render(
    <SyncProvider userId="u1" deps={deps}>
      <Text>Sets</Text>
    </SyncProvider>,
  )
  await screen.findByText('Sets')

  background()
  setOnline(false)
  expect(deps.requestSync).toHaveBeenCalledTimes(1)
  foreground()
  setOnline(true)
  expect(deps.requestSync).toHaveBeenCalledTimes(3)
})
```

`apps/mobile/src/features/sync/confirmSignOut.test.ts`:

```ts
import { createConfirmSignOut } from './confirmSignOut'

function setup(pending: number) {
  const log: string[] = []
  const deps = {
    pendingCount: () => pending,
    signOut: jest.fn(async () => void log.push('signOut')),
    wipe: jest.fn(async () => {
      log.push('wipe')
      return pending
    }),
    alert: jest.fn(),
  }
  return { confirmSignOut: createConfirmSignOut(deps), deps, log }
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

test('with nothing queued, signs out and clears local data straight away', async () => {
  const { confirmSignOut, deps, log } = setup(0)
  confirmSignOut()
  await flushPromises()
  expect(deps.alert).not.toHaveBeenCalled()
  expect(log).toEqual(['signOut', 'wipe'])
})

test('with results queued, asks first and only signs out on confirm', async () => {
  const { confirmSignOut, deps, log } = setup(2)
  confirmSignOut()
  expect(log).toEqual([])
  const [title, message, buttons] = deps.alert.mock.calls[0] as unknown as [
    string,
    string,
    { text: string; onPress: () => void }[],
  ]
  expect(title).toBe('Sign out?')
  expect(message).toBe(
    "2 study results haven't synced yet. Signing out deletes them from this phone.",
  )
  expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Sign out'])

  buttons[1].onPress()
  await flushPromises()
  expect(log).toEqual(['signOut', 'wipe'])
})
```

Replace `apps/mobile/src/features/sets/SetListScreen.test.tsx` with:

```tsx
import { fireEvent, screen } from '@testing-library/react-native'
import { api } from '@/lib/api'
import { renderWithQuery } from '@/test/renderWithQuery'
import { SetListScreen } from './SetListScreen'

jest.mock('@/lib/api', () => ({
  api: { studySets: { listStudySets: jest.fn() } },
}))

const listStudySets = api.studySets.listStudySets as jest.Mock

const set = (id: string, title: string, description: string | null = null) => ({
  id,
  title,
  description,
  image_path: null,
  fallback_image_paths: [],
})

function renderList(overrides: Partial<Parameters<typeof SetListScreen>[0]> = {}) {
  const props = {
    onOpenSet: jest.fn(),
    onSignOut: jest.fn(),
    status: 'Synced just now',
    onRefresh: jest.fn(async () => {}),
    ...overrides,
  }
  return renderWithQuery(<SetListScreen {...props} />).then(() => props)
}

beforeEach(() => listStudySets.mockReset())

test("lists the learner's sets and opens one when tapped", async () => {
  listStudySets.mockResolvedValue([set('s1', 'Verbos', 'Common verbs'), set('s2', 'Comida')])
  const { onOpenSet } = await renderList()

  await fireEvent.press(await screen.findByText('Verbos'))

  expect(screen.getByText('Common verbs')).toBeOnTheScreen()
  expect(screen.getByText('Comida')).toBeOnTheScreen()
  expect(onOpenSet).toHaveBeenCalledWith('s1')
})

test('shows the sync status line', async () => {
  listStudySets.mockResolvedValue([set('s1', 'Verbos')])
  await renderList({ status: 'Offline · 2 answers waiting to sync' })
  expect(await screen.findByText('Offline · 2 answers waiting to sync')).toBeOnTheScreen()
})

test('pull to refresh runs a sync', async () => {
  listStudySets.mockResolvedValue([set('s1', 'Verbos')])
  const { onRefresh } = await renderList()
  await screen.findByText('Verbos')

  await fireEvent(screen.getByTestId('set-list-refresh'), 'refresh')

  expect(onRefresh).toHaveBeenCalled()
})

test('shows an empty state that points to the web app', async () => {
  listStudySets.mockResolvedValue([])
  await renderList()
  expect(await screen.findByText(/No study sets yet/)).toBeOnTheScreen()
})

test('shows an error with a retry that refetches', async () => {
  listStudySets
    .mockRejectedValueOnce(new Error('Network request failed'))
    .mockResolvedValueOnce([set('s1', 'Verbos')])
  await renderList()

  await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('Verbos')).toBeOnTheScreen()
})

test('sign out is offered', async () => {
  listStudySets.mockResolvedValue([])
  const { onSignOut } = await renderList()
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }))
  expect(onSignOut).toHaveBeenCalled()
})
```

In `apps/mobile/src/features/sets/SetDetailScreen.test.tsx`:

1. Replace the `cardImages: { getSignedImageUrl: jest.fn() },` line in the `@/lib/api` mock with nothing.
2. Add below that mock:

   ```tsx
   jest.mock('@/features/sync/useLocalImageUri', () => ({
     useLocalImageUri: jest.fn((path: string | null) => (path ? `file:///images/${path}` : null)),
   }))
   ```

   and `import { useLocalImageUri } from '@/features/sync/useLocalImageUri'`.

3. In `beforeEach`, delete the `getSignedImageUrl` line.
4. In the first test, replace `expect(api.cardImages.getSignedImageUrl).toHaveBeenCalledWith('u/c2.webp')` with:

   ```tsx
   expect(useLocalImageUri).toHaveBeenCalledWith('u/c2.webp')
   ```

In `apps/mobile/src/features/study/StudyScreen.test.tsx`:

1. Delete `cardImages: { getSignedImageUrl: jest.fn() },` from the api mock.
2. Delete the whole `jest.mock('expo-image', …)` block.
3. Add:

   ```tsx
   jest.mock('@/features/sync/useLocalImageUri', () => ({ useLocalImageUri: jest.fn(() => null) }))
   ```

4. In `beforeEach`, delete the `getSignedImageUrl` line.

In `apps/mobile/src/features/study/QuizCard.test.tsx`, rename the test `'shows a placeholder while the image URL loads'` to `'shows a placeholder until the image is downloaded'`, and change its assertion to `expect(screen.getByText('Image not downloaded yet')).toBeOnTheScreen()`.

- [ ] **Step 2: Run them to verify they fail**

Run from `apps/mobile`: `bunx jest src/features/sync src/features/sets src/features/study`
Expected: FAIL, including:

- "Cannot find module" for `localData`, `SyncProvider` and `confirmSignOut`
- "Unable to find an element with testID: set-list-refresh"
- the QuizCard placeholder text not found

- [ ] **Step 3: Write the implementation**

`apps/mobile/src/features/sync/localData.ts`:

```ts
import type { KeyValueStorage } from './outbox'

const OWNER_KEY = 'escritorio-local-owner'

/**
 * Everything cached on the phone (sets, cards, images, queued results)
 * belongs to one user. A session that ends on its own keeps it for that
 * user; a different user signing in, or an explicit sign-out, wipes it.
 */
export function createLocalData({
  storage,
  clearCache,
  clearImages,
  clearOutbox,
  clearSyncStatus,
}: {
  storage: KeyValueStorage
  clearCache: () => void
  clearImages: () => Promise<void>
  clearOutbox: () => Promise<number>
  clearSyncStatus: () => Promise<void>
}) {
  async function clearAll(): Promise<number> {
    clearCache()
    const [discarded] = await Promise.all([clearOutbox(), clearImages(), clearSyncStatus()])
    return discarded
  }

  return {
    /** Resolves to how many unsent results of a previous user were discarded. */
    async claim(userId: string): Promise<{ discarded: number }> {
      const owner = await storage.getItem(OWNER_KEY)
      const discarded = owner && owner !== userId ? await clearAll() : 0
      await storage.setItem(OWNER_KEY, userId)
      return { discarded }
    },
    async wipe(): Promise<number> {
      const discarded = await clearAll()
      await storage.removeItem(OWNER_KEY)
      return discarded
    },
  }
}
```

`apps/mobile/src/features/sync/SyncProvider.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from 'react'

export type SyncDeps = {
  claimLocalData: (userId: string) => Promise<{ discarded: number }>
  /** Reads the outbox, image manifest and last sync time from storage. */
  load: () => Promise<void>
  resumeOutbox: () => Promise<void>
  requestSync: () => Promise<void>
  appState: {
    addEventListener(event: 'change', listener: (state: string) => void): { remove(): void }
  }
  subscribeOnline: (listener: (online: boolean) => void) => () => void
  alert: (title: string, message: string) => void
}

/**
 * Signed-in shell for offline sync. Nothing renders until this user owns
 * the local data, so a different user never sees the previous one's sets.
 * Then it syncs at launch, on return to the foreground and on reconnect.
 */
export function SyncProvider({
  userId,
  deps,
  children,
}: {
  userId: string
  deps: SyncDeps
  children: ReactNode
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    void (async () => {
      const { discarded } = await deps.claimLocalData(userId)
      await deps.load()
      if (cancelled) return
      if (discarded > 0) {
        deps.alert(
          'Unsynced results removed',
          `${discarded} study result${discarded === 1 ? '' : 's'} from the account that was signed in before hadn't synced. They were removed from this phone.`,
        )
      }
      // A session that ended (refresh token rejected) paused the outbox.
      await deps.resumeOutbox()
      setReady(true)
      void deps.requestSync()
    })()
    return () => {
      cancelled = true
    }
  }, [userId, deps])

  useEffect(() => {
    if (!ready) return
    const appState = deps.appState.addEventListener('change', (state) => {
      if (state === 'active') void deps.requestSync()
    })
    const unsubscribe = deps.subscribeOnline((online) => {
      if (online) void deps.requestSync()
    })
    return () => {
      appState.remove()
      unsubscribe()
    }
  }, [ready, deps])

  return ready ? children : null
}
```

`apps/mobile/src/features/sync/confirmSignOut.ts`:

```ts
type AlertButton = { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }

/** Explicit sign-out clears the phone's copy of the user's data, after a warning if results are still queued. */
export function createConfirmSignOut({
  pendingCount,
  signOut,
  wipe,
  alert,
}: {
  pendingCount: () => number
  signOut: () => Promise<void>
  wipe: () => Promise<number>
  alert: (title: string, message: string, buttons: AlertButton[]) => void
}) {
  async function signOutAndWipe() {
    await signOut()
    await wipe()
  }

  return function confirmSignOut() {
    const pending = pendingCount()
    if (pending === 0) {
      void signOutAndWipe()
      return
    }
    alert(
      'Sign out?',
      `${pending} study result${pending === 1 ? '' : 's'} haven't synced yet. Signing out deletes them from this phone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOutAndWipe() },
      ],
    )
  }
}
```

`apps/mobile/src/features/sync/useSyncStatusLine.ts`:

```ts
import { onlineManager } from '@tanstack/react-query'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { outbox, syncEngine } from './instances'
import { statusLine } from './statusLine'

const subscribeOnline = (listener: () => void) => onlineManager.subscribe(listener)

export function useSyncStatusLine(): string {
  const status = useSyncExternalStore(syncEngine.subscribe, syncEngine.getStatus)
  const queue = useSyncExternalStore(outbox.subscribe, outbox.getState)
  const online = useSyncExternalStore(subscribeOnline, () => onlineManager.isOnline())
  // Re-render every 30 s so "Synced 2 min ago" keeps up.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return statusLine({
    online,
    syncing: status.syncing,
    failed: status.failed,
    lastSyncedAt: status.lastSyncedAt,
    pendingAnswers: queue.pending.filter((op) => op.type === 'createQuizAttempt').length,
    now,
  })
}
```

In `apps/mobile/src/features/sync/instances.ts`, add the import:

```ts
import { createLocalData } from './localData'
```

and at the end:

```ts
export const localData = createLocalData({
  storage: AsyncStorage,
  clearCache: () => queryClient.clear(),
  clearImages: () => imageStore.clear(),
  clearOutbox: () => outbox.clear(),
  clearSyncStatus: () => syncEngine.clear(),
})
```

Replace `apps/mobile/src/app/(app)/_layout.tsx` with:

```tsx
import { onlineManager } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { Alert, AppState } from 'react-native'
import { useAuth } from '@/features/auth/AuthProvider'
import { imageStore, localData, outbox, syncEngine } from '@/features/sync/instances'
import { SyncProvider, type SyncDeps } from '@/features/sync/SyncProvider'

const syncDeps: SyncDeps = {
  claimLocalData: (userId) => localData.claim(userId),
  load: async () => {
    await Promise.all([imageStore.load(), syncEngine.load()])
  },
  resumeOutbox: () => outbox.resume(),
  requestSync: () => syncEngine.requestSync(),
  appState: AppState,
  subscribeOnline: (listener) => onlineManager.subscribe(listener),
  alert: (title, message) => Alert.alert(title, message),
}

export default function SignedInLayout() {
  const auth = useAuth()
  // The root layout only mounts this group when signed in.
  if (auth.status !== 'signedIn') return null
  return (
    <SyncProvider userId={auth.user.id} deps={syncDeps}>
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
    </SyncProvider>
  )
}
```

Replace `apps/mobile/src/app/(app)/index.tsx` with:

```tsx
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Alert } from 'react-native'
import { useSignOut } from '@/features/auth/AuthProvider'
import { SetListScreen } from '@/features/sets/SetListScreen'
import { createConfirmSignOut } from '@/features/sync/confirmSignOut'
import { localData, outbox, syncEngine } from '@/features/sync/instances'
import { useSyncStatusLine } from '@/features/sync/useSyncStatusLine'

export default function SetListRoute() {
  const router = useRouter()
  const status = useSyncStatusLine()
  // Temporary home for sign-out until Settings (DR-15) owns it.
  const signOut = useSignOut()
  const confirmSignOut = useMemo(
    () =>
      createConfirmSignOut({
        pendingCount: () => outbox.getState().pending.length,
        signOut,
        wipe: () => localData.wipe(),
        alert: (title, message, buttons) => Alert.alert(title, message, buttons),
      }),
    [signOut],
  )
  return (
    <SetListScreen
      onOpenSet={(id) => router.push({ pathname: '/sets/[id]', params: { id } })}
      onSignOut={confirmSignOut}
      status={status}
      onRefresh={() => syncEngine.requestSync()}
    />
  )
}
```

In `apps/mobile/src/app/_layout.tsx`, delete the line `const clearCache = () => queryClient.clear()` and the prop `onSignedOut={clearCache}`. A session that ends on its own now keeps the user's data, and explicit sign-out wipes it in `confirmSignOut`.

In `apps/mobile/src/features/sets/SetListScreen.tsx`:

1. Change the import line to:

   ```tsx
   import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
   import { useState } from 'react'
   ```

2. Change the props to:

   ```tsx
   export function SetListScreen({
     onOpenSet,
     onSignOut,
     status,
     onRefresh,
   }: {
     onOpenSet: (id: string) => void
     onSignOut: () => void
     /** The sync status line, e.g. "Synced 2 min ago". */
     status: string
     /** Pull to refresh runs a full sync. */
     onRefresh: () => Promise<void>
   }) {
     const { data, error, isPending, refetch } = useStudySets()
     const [refreshing, setRefreshing] = useState(false)

     async function refresh() {
       setRefreshing(true)
       try {
         await onRefresh()
       } finally {
         setRefreshing(false)
       }
     }
   ```

3. On the `FlatList`, replace the `refreshControl` prop with:

   ```tsx
   refreshControl={
     <RefreshControl
       testID="set-list-refresh"
       refreshing={refreshing}
       onRefresh={() => void refresh()}
     />
   }
   ListHeaderComponent={
     <Text className="px-4 pb-2 pt-1 text-sm text-muted-foreground">{status}</Text>
   }
   ```

In `apps/mobile/src/features/sets/hooks.ts`:

1. Replace the first comment with:

   ```ts
   // Reads come from the persisted cache; the sync engine (features/sync) refreshes it.
   // A query only fetches by itself when nothing is cached yet.
   ```

2. Delete `useSignedImageUrl` entirely.

In `apps/mobile/src/features/sets/SetDetailScreen.tsx`:

1. Change the hooks import to `import { useCards, useStudySet } from './hooks'`.
2. Add `import { useLocalImageUri } from '@/features/sync/useLocalImageUri'`.
3. In `CardRow`, replace `const { data: imageUrl } = useSignedImageUrl(card.image_path)` with `const imageUrl = useLocalImageUri(card.image_path)`.

In `apps/mobile/src/features/study/StudyScreen.tsx`:

1. Remove `import { Image } from 'expo-image'`.
2. Change the hooks import to `import { useCards, useStudySet } from '@/features/sets/hooks'`.
3. Add `import { useLocalImageUri } from '@/features/sync/useLocalImageUri'`.
4. Replace these lines:

   ```tsx
   const { data: imageUrl } = useSignedImageUrl(imagePathFor(question))
   const { data: nextImageUrl } = useSignedImageUrl(imagePathFor(run?.questions[index + 1]))
   useEffect(() => {
     if (nextImageUrl) Image.prefetch(nextImageUrl).catch(() => {})
   }, [nextImageUrl])
   ```

   with:

   ```tsx
   // Images are on the device already (image sync); nothing to prefetch.
   const imageUrl = useLocalImageUri(imagePathFor(question))
   ```

In `apps/mobile/src/features/study/QuizCard.tsx`, change `Loading image…` to `Image not downloaded yet`.

In `docs/superpowers/specs/2026-10-13-ios-app-design.md`, replace the two **Verify during implementation** bullets with what was verified:

- Image sync: `list()` returns `updated_at` (and overwriting changes it), sub-folders come back with `id: null`, and `limit`/`offset` paginate. DR-14 lists `owner/` and `owner/sets/` by 100.
- Outbox: `ON CONFLICT DO NOTHING` upserts succeed under the insert-only policies (DR-11 integration tests), so no fallback to a plain insert is needed.

- [ ] **Step 4: Run tests, typecheck, lint, bundle**

Run from `apps/mobile`: `bun run test && bun run typecheck && bun run export:ios && rm -r ./dist-export`
Then from the root: `bun run test && bunx oxlint apps/mobile packages/core && bunx prettier --check apps/mobile/src packages/core/src docs/superpowers`
Expected:

- Every suite PASSES.
- No type errors, and the export succeeds.
- No new lint warnings; only the two known `AuthProvider.tsx` warnings remain.
- Prettier is clean for the files this PR touched. The three plan docs it already flags are untouched.

- [ ] **Step 5: Commit**

```bash
git add -A apps/mobile docs/superpowers/specs/2026-10-13-ios-app-design.md
git commit -m "feat(mobile): sync on launch, foreground, reconnect and pull; local images; status line

Explicit sign-out warns about unsynced results and clears local data; a
different user signing in starts from a clean phone.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## On-device check (after Task 7; a dev build needs `bunx expo run:ios --device` for the new native modules)

1. Launch online. The set list shows "Syncing…", then "Synced just now". Card images appear on the set page and in the quiz.
2. Turn on airplane mode, force-quit, and relaunch:
   - the sets, cards and images are all there
   - the status line says "Offline"
3. Still offline, finish a session. The status line says "Offline · N answers waiting to sync".
4. Turn airplane mode off. The status line clears. In Supabase there is one `study_sessions` row with `completed_at`, plus one `quiz_attempts` row per card, each exactly once.
5. On the web, replace a card's image, then pull to refresh on the phone. The new image shows.
6. On the web, delete a card while the phone is offline. Answer that card on the phone, then reconnect. The queue drains, and the rejected attempt is in the "couldn't sync" list (`outbox.getState().failed`; Settings shows it in DR-15).
7. Queue an answer offline, then tap Sign out. A warning names the count. Confirming signs out and clears the phone.
