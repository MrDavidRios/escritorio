# iOS app design

## Problem

Escritorio is web-only today (Vite + React, deployed to GitHub Pages,
backed by Supabase). Studying flashcards is a phone activity, often in
places without connectivity, and the web app neither feels native on
iOS nor works offline.

We're adding a native iOS app built with Expo / React Native that lets
a signed-in learner study their sets — including fully offline — while
sharing the domain logic (grading, study modes, types, schemas, data
access) with the web app so the two can't drift.

Success for v1: a learner from the existing small group installs the
app via TestFlight, signs in once, and can study every one of their
sets in airplane mode, with every quiz attempt eventually landing in
Supabase exactly once.

## Decisions made

| Question             | Decision                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| Technology           | Expo / React Native (not PWA, Capacitor, or SwiftUI)                                                         |
| v1 scope             | Study-first: sign in, browse sets, study. Editing stays on web                                               |
| Offline              | Automatic and complete: all of the user's sets, cards, and images are mirrored to the device whenever online |
| Repo layout          | Monorepo in this repo (Bun workspaces)                                                                       |
| Accounts             | Sign-in only; sign-up and password reset link out to the web app                                             |
| Offline data layer   | Persisted TanStack Query cache + local image store + write outbox                                            |
| Build / distribution | EAS Build + EAS Submit to TestFlight; EAS Update for JS-only fixes                                           |

## Non-goals (v1)

- Creating, editing, or deleting study sets or cards on mobile; image
  upload; definition lookup. (Planned follow-up: full parity.)
- In-app sign-up and in-app account deletion. Because the app cannot
  create accounts, App Store guideline 5.1.1(v) does not require
  in-app deletion. Must be revisited if sign-up is ever added.
- Per-set "download for offline" management — everything is mirrored.
- iPad-specific layouts (runs in compatibility/scaled mode).
- Public App Store listing — TestFlight external testing only.
- Any database migration. The existing schema already supports
  client-supplied ids and timestamps.

## Repo structure

```
escritorio/
├── package.json            # Bun workspaces root: ["apps/*", "packages/*"]
├── apps/
│   ├── web/                # current Vite app, moved with git mv
│   └── mobile/             # new Expo app (latest SDK, Expo Router, TS)
├── packages/
│   └── core/               # @escritorio/core — TypeScript source, no build step
│       └── src/
│           ├── types/          # ← src/types/*
│           ├── grading.ts      # ← src/lib/grading.ts (+ test)
│           ├── studyMode.ts    # ← src/features/study/studyMode.ts (+ test)
│           ├── schemas/        # ← cardSchema, studySetSchema, authSchema
│           ├── dictionaryApi.ts # (+ test)
│           ├── api/            # ← src/api/*, client-injected (below)
│           └── queryKeys.ts    # shared TanStack Query keys
└── supabase/migrations/    # unchanged, stays at repo root
```

### `@escritorio/core` rules

- No React, no DOM, no React Native imports. Pure TypeScript plus
  `@supabase/supabase-js` types and `zod`.
- Consumed as TS source via package `exports`; Vite and Metro both
  compile it. Metro uses Expo's built-in monorepo support.
- Internal imports are relative (no `@/` alias), so it resolves the
  same way under both bundlers.

### Client-injected API

Today `src/api/*` imports a singleton from `@/lib/supabase`. In core:

```ts
export function createApi(supabase: SupabaseClient) {
  return { studySets, cards, cardImages, studySetImages, quizAttempts, studySessions }
}
```

Each app constructs its own client (web: default localStorage;
mobile: encrypted storage, below) and calls `createApi` once.

API signature changes needed by mobile (backwards compatible for web):

- `createQuizAttempt` accepts optional `id` and `answered_at`, and
  inserts with `upsert(..., { onConflict: 'id', ignoreDuplicates: true })`.
- `createStudySession` accepts optional `id` and `started_at`, same
  insert behaviour.
- `uploadCardImage` / `uploadStudySetImage` accept `Blob | ArrayBuffer`
  plus a content type instead of a DOM `File` (unused by mobile v1,
  but keeps core DOM-free).

Hooks stay per-app. Web hooks are unchanged apart from imports;
mobile hooks are offline-aware. Both use `queryKeys.ts` from core.

## Mobile app

### Screens (Expo Router)

| Route              | Screen                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `/sign-in`         | Email + password. "Forgot password?" and "Create an account" open the web app in Safari                                                       |
| `/`                | List of the user's sets with a sync status line ("Synced 2 min ago" / "Offline" / "3 attempts pending")                                       |
| `/sets/[id]`       | Title, card count, read-only card preview, study-mode picker (same options as web), **Study**                                                 |
| `/sets/[id]/study` | Quiz: image and/or prompt, answer field, accented-character pad, 3-attempt grading via core `studyMode.ts` + `grading.ts`, completion summary |
| `/settings`        | Signed-in account, last sync, storage used, **Sync now**, "couldn't sync" count, sign out                                                     |

### Auth

- Supabase client uses the LargeSecureStore pattern from Supabase's
  React Native guide: the session is AES-encrypted in AsyncStorage,
  with the key in the iOS Keychain (`expo-secure-store`). Plain
  SecureStore isn't enough because of its 2 KB per-value limit.
- `autoRefreshToken` is started and stopped with `AppState`
  (foreground and background); `detectSessionInUrl: false`.
- **Offline-first gating:** the user counts as signed in when a stored
  session exists, even if its access token has expired. An expired
  access token while offline must never block studying. The token is
  refreshed when back online; refresh tokens don't expire by default.
- The user only sees the sign-in screen after an explicit sign-out,
  or when the refresh token is rejected online (password changed or
  session revoked). In the second case the outbox is kept and sent
  after the same user signs back in. If a different user signs in,
  the outbox is discarded, after a warning.
- Sign-out clears the query cache, the image store, and the outbox.
  If the outbox isn't empty, the user is warned first.

### Study mode picker

Changing mode/direction/visibility updates the cached `study_sets` row
optimistically and enqueues an `updateStudySetMode` outbox op
(last write wins), so it works offline.

### UI

- NativeWind, with theme tokens mirrored from the web app's Tailwind
  theme so both apps share a visual vocabulary.
- Native stack navigation, large titles, pull-to-refresh triggers a
  sync, and the theme follows the system light/dark setting.
- Answer field: `autoCapitalize="none"`, `autoCorrect={false}`,
  `spellCheck={false}`, `returnKeyType="go"` submits. The accented-
  character pad sits above the keyboard (`KeyboardAvoidingView`).
- `expo-haptics`: success on correct, warning on retry, error on
  revealed.

## Offline sync

### Read path (server → device)

- TanStack Query with `@tanstack/react-query-persist-client` + an
  AsyncStorage persister. Cached data never expires (`gcTime:
Infinity`, persister `maxAge: Infinity`). All queries use
  `networkMode: 'offlineFirst'`. `onlineManager` is driven by
  `@react-native-community/netinfo`.
- **Sync triggers:** app launch, app returning to the foreground,
  reconnect, pull-to-refresh, "Sync now". Only one sync runs at a
  time; any trigger that fires during a sync is merged into a single
  follow-up run.
- **A sync run, in order:**
  1. Send the outbox (so the server has our writes before we read).
  2. Fetch all of the user's `study_sets`, then all of their `cards`
     in one query (`owner_id = auth.uid()`), and replace the cached
     copies. Rows deleted on the server disappear locally.
  3. Image sync (below).
- **Image sync:**
  - Wanted set = every non-null `cards.image_path` and
    `study_sets.image_path` in the fresh data.
  - Remote versions come from one `storage.from('flashcard-images').list(ownerId)`
    call per sync, read for each object's `updated_at`. This is needed
    because card images are overwritten at the same path
    (`${owner}/${cardId}.ext`, upload with `upsert`), so the path alone
    can't tell us an image changed.
  - Local manifest (persisted JSON): `path → { updatedAt, localUri }`.
  - Download every wanted path that is missing locally or newer
    remotely: batch `createSignedUrls`, then
    `FileSystem.downloadAsync`, four at a time. Delete local files no
    longer wanted.
  - Files live in `documentDirectory/images/`, not the cache directory,
    because iOS may clear the cache directory when the phone needs space.
  - The study screen only renders local `file://` URIs. It never
    fetches images over the network.
  - **Verify during implementation:** `list()` returns `updated_at` for
    objects in this bucket under the current storage policies, and
    the per-call limit covers the user's file count (paginate if not).

### Write path (device → server): outbox

- A persisted FIFO queue of operations, sent one at a time
  (ordering matters: an attempt's `session_id` references its
  session).
- Operation types:
  - `createStudySession { id, study_set_id, mode, direction, visibility, deck_size, started_at }`
  - `completeStudySession { id, completed_at, cards_correct }`
  - `createQuizAttempt { id, card_id, is_correct, attempt_count, session_id, resolved_direction, answered_at }`
  - `updateStudySetMode { study_set_id, study_mode, conversion_direction, meaning_visibility }`
- Ids come from `expo-crypto` `randomUUID()` and timestamps are taken
  when the event happens, so analytics reflect when the learner
  actually studied, not when the sync happened.
- Repeated sends are harmless: creates use upsert with
  `ignoreDuplicates` (`INSERT … ON CONFLICT DO NOTHING`), so a retry
  after a lost response is a no-op. Updates already produce the same
  result when repeated.
- **Verify during implementation:** `ON CONFLICT DO NOTHING` upserts
  succeed under the current RLS policies. `quiz_attempts` has insert
  and select policies but no update policy. If PostgREST requires
  update permission for this path, fall back to a plain insert and
  treat a unique-violation error (`23505`) as success.

### Error handling

| Failure                                                       | Behaviour                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Network error / 5xx                                           | Stop sending, keep the queue, retry on the next trigger with exponential backoff                                   |
| 401 / auth error                                              | Try refreshing the token. If that fails, pause the outbox and prompt sign-in. The outbox is kept for the same user |
| Other 4xx (e.g. card deleted on web → lineage trigger raises) | Move the op to a persisted "couldn't sync" list, continue with the next op, and show the count in Settings         |
| Image download fails                                          | That card shows a placeholder, the image is retried next sync, and other downloads continue                        |

## Build and distribution

- **EAS Build** (cloud; `eas build --local` as a fallback with no
  quota) and **EAS Submit** to App Store Connect, distributed to the
  group as TestFlight external testers. The first build needs beta
  review.
- **EAS Update** (`production` channel) for JS-only changes. Runtime
  version policy `fingerprint`, so an update can't reach a build
  whose native code doesn't match.
- Native changes (new native module, SDK upgrade, app config) need a
  new TestFlight build. Builds expire after 90 days, so a new build is
  needed at least every ~80 days.
- Config: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  as EAS environment variables. Bundle id (e.g.
  `com.davidrios.escritorio`) chosen at scaffold time. Needs a
  1024×1024 app icon source; the current 512px favicon is too small.

## CI

- `deploy.yml` (Pages): updated for the workspace layout (build in
  `apps/web`, upload `apps/web/dist`). Otherwise unchanged.
- New `mobile.yml`: on PRs touching `packages/core` or `apps/mobile`,
  run lint, typecheck, and tests for both. App Store builds are not
  run on every PR; they're started manually or by a `mobile-v*` tag.

## Testing

- **`packages/core`** (Vitest): existing grading, study mode, and
  dictionary tests move here. New tests cover the API functions
  passing through optional ids and timestamps and using
  `ignoreDuplicates`, against a mocked client.
- **`apps/mobile`** (`jest-expo` + React Native Testing Library):
  - The outbox and sync engine are plain modules that take the API
    as a parameter, tested with fakes: FIFO order, retrying without
    duplicates, each error class, pausing and resuming on auth errors,
    and merging overlapping sync triggers.
  - Image manifest comparison: missing, changed (newer
    `updated_at`), and orphaned files.
  - Study screen: 3-attempt flow, accent pad insertion at the
    cursor, completion summary, and outbox ops enqueued with the
    right ids and order.
- **Manual device checklist** (each TestFlight release):
  - Go into airplane mode mid-session, finish the session, reconnect,
    and verify the session and attempts each appear in Supabase
    exactly once.
  - Cold-launch offline with an expired access token: studying works.
  - Delete a card on the web while the phone is offline, answer that
    card on the phone, reconnect: the op lands in "couldn't sync" and
    the queue keeps going.
  - Replace a card image on the web and sync: the phone shows the new
    image.
  - Sign out with queued ops: warning shown, and local data cleared
    after confirming.

## Rollout (one PR each)

1. **Monorepo restructure.** Move the web app to `apps/web` (with
   `git mv`), extract `packages/core`, and update CI. Web behaviour
   must not change.
2. **Core API changes.** Client injection, optional ids and
   timestamps with `ignoreDuplicates`, and `Blob | ArrayBuffer`
   uploads. Web switches to `createApi(supabase)`.
3. **Mobile scaffold.** Expo app, encrypted auth storage,
   offline-first sign-in check, set list and set detail (online only).
4. **Study screen.** Quiz flow, mode picker, haptics.
5. **Offline.** Persisted cache, outbox, image sync, sync triggers
   and status line.
6. **Settings, polish, first TestFlight build.** Settings screen,
   app icon and splash screen, EAS config, `mobile.yml`, first
   build submitted.
