# DR-12 Mobile Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `apps/mobile`, an Expo app where a learner signs in once (session encrypted on the device) and browses their study sets and each set's cards. Data is online-only for now.

**Architecture:**
- Expo SDK 58 with Expo Router (file routes, `Stack.Protected` auth gating), NativeWind 4 with theme tokens mirrored from web, TanStack Query, and `createApi(supabase)` from `@escritorio/core`.
- The Supabase session is stored with a LargeSecureStore: the session is AES-encrypted in AsyncStorage and the key is kept in the Keychain.
- Sign-in gating is offline-first. It reads the stored session itself rather than trusting `getSession()`, which returns `null` offline once the access token has expired.

**Tech Stack:** Expo SDK 58, Expo Router 58, React Native (version pinned by `expo install`), NativeWind 4.2 + Tailwind CSS 3.4, `@tanstack/react-query` 5, `@supabase/supabase-js` 2, `expo-secure-store`, `@react-native-async-storage/async-storage`, `aes-js`, `jest-expo` + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-10-13-ios-app-design.md`. Relevant sections: "Mobile app" (Screens, Auth, UI), "Build and distribution" (bundle id, env vars), "Testing", and rollout step 3.

**Stacking:** This branch is `feat/dr-12-…`, created with `gh stack add` on top of DR-11 (PR #26). Publish it with `gh stack submit`.

## Global Constraints

- **Core rules:** core has no React, DOM or React Native imports. The mobile app consumes core as TS source through Metro (Expo's built-in monorepo support), so don't add manual `watchFolders`/`extraNodeModules` to the Metro config.
- **Auth:** the Supabase client uses LargeSecureStore (AES-encrypted session in AsyncStorage, key in the Keychain via `expo-secure-store`). Plain SecureStore isn't enough because of its 2 KB per-value limit.
- **Token refresh:** `autoRefreshToken` is started and stopped with `AppState` (foreground/background), and `detectSessionInUrl: false`.
- **Offline-first gating:** the user counts as signed in when a stored session exists, even if its access token has expired. An expired access token while offline must never block access.
- **Sign-in screen:** email + password only. "Create an account" opens the web app in Safari.
- **UI:** NativeWind with theme tokens mirrored from the web app's Tailwind theme. Native stack navigation, a large title on the list, pull-to-refresh, and the theme follows the system light/dark setting.
- **Config:** `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Bundle id `com.davidrios.escritorio`.
- **Tests:** `apps/mobile` uses `jest-expo` + React Native Testing Library.
- **Duplicates:** never duplicate React Native or native modules in the monorepo (`bun pm why react-native` must show one version).
- **Commits:** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Rulings made while planning (spec gaps)

- **"Forgot password?" is left out.** The spec says it opens the web app, but the web app has no password-reset flow (`apps/web/src/app/router.tsx` only has `/login` and `/signup`). A link to it would lead nowhere. Add it once web has a reset page.
- **Temporary "Sign out" button on the set list header.** Settings (where sign-out lives per the spec) is DR-15, but without a sign-out the auth flow can't be exercised end to end. It clears the query cache and signs out. There's no outbox yet, so there's nothing to warn about.
- **The set detail screen has no mode picker or Study button yet.** Both are in DR-13.
- **Dark-mode `--border` is approximated.** Web uses `oklch(1 0 0 / 10%)` (a translucent border). Mobile uses the opaque equivalent on the dark background, `38 38 38`.

## Review Focus

1. **Expired token while offline.** Cold-launching with a stored session whose access token has expired, while offline, must land on the set list and never on sign-in. `getSession()` returns `null` there, so gating must come from the stored session. This is pinned by the `AuthProvider` tests in Task 3.
2. **Refresh token rejected online.** When auth-js deletes the session and emits `SIGNED_OUT`, the app must return to sign-in. Pinned by the Task 3 tests.
3. **Key and data out of step.** If the Keychain key is gone but encrypted data remains in AsyncStorage (or the reverse), reading the session must return `null`, not garbage or a crash. Pinned by the Task 2 tests.
4. **Monorepo bundling.** Metro must resolve `@escritorio/core` (TS source outside `apps/mobile`) and `@supabase/supabase-js`, with no duplicate React Native. Pinned by `expo export --platform ios` in Task 1 and `bun pm why react-native`.
5. **Root scripts include mobile.** Root `bun run test` / `typecheck` must run mobile's jest and tsc, and fail when they fail. Pinned by the Task 1 verification step.

---

### Task 1: Scaffold `apps/mobile` (Expo Router, NativeWind, Jest, theme)

**Files:**
- Create: `apps/mobile/` (from the `blank-typescript@sdk-58` template), then edit `apps/mobile/package.json` and `app.json`
- Create: `apps/mobile/{babel.config.js,metro.config.js,tailwind.config.js,global.css,nativewind-env.d.ts,jest.config.js,.env.local.example}`
- Create: `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/index.tsx`
- Create: `apps/mobile/src/components/Screen.tsx`, `apps/mobile/src/components/Screen.test.tsx`
- Delete: the template's `App.tsx` and `index.ts`
- Modify: `README.md`

**Interfaces:**
- Produces:
  - Path alias `@/*` → `apps/mobile/src/*`
  - `<Screen>` (a themed `SafeAreaView` wrapper: `flex-1 bg-background`)
  - Tailwind color tokens `background`, `foreground`, `card`, `muted`, `muted-foreground`, `primary`, `primary-foreground`, `border`, `destructive`
  - Scripts on `@escritorio/mobile`: `start`, `ios`, `typecheck`, `test`, `export:ios`

- [ ] **Step 1: Create the app**

From the repo root:

```bash
bun create expo --template blank-typescript@sdk-58 apps/mobile --no-install
rm apps/mobile/App.tsx apps/mobile/index.ts
rm -rf apps/mobile/.git   # in case the template initialised one
```

In `apps/mobile/package.json`:
- Set `"name": "@escritorio/mobile"`, `"private": true` and `"main": "expo-router/entry"`.
- Add `"@escritorio/core": "workspace:*"` to `dependencies`.
- Replace `scripts` with:

```json
{
  "start": "expo start",
  "ios": "expo start --ios",
  "typecheck": "tsc --noEmit",
  "test": "jest",
  "export:ios": "expo export --platform ios --output-dir dist-export"
}
```

Then run `bun install` at the root, and from `apps/mobile` run:

```bash
bunx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
bunx expo install nativewind react-native-reanimated react-native-worklets
bunx expo install -- --dev tailwindcss@^3.4.17 jest-expo jest @testing-library/react-native @types/jest
```

Expected: `bun pm why react-native` (at the root) shows exactly one `react-native` version. NativeWind resolves to `4.2.x`, not the 5.0 rc.

- [ ] **Step 2: Configure the app**

`apps/mobile/app.json`: inside `expo`, set or replace these keys and keep everything else the template wrote.

```json
{
  "name": "Escritorio",
  "slug": "escritorio",
  "scheme": "escritorio",
  "userInterfaceStyle": "automatic",
  "ios": { "bundleIdentifier": "com.davidrios.escritorio", "supportsTablet": false },
  "plugins": ["expo-router"],
  "experiments": { "typedRoutes": true }
}
```

`apps/mobile/tsconfig.json`:

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts", "nativewind-env.d.ts"]
}
```

`apps/mobile/babel.config.js`:

```js
module.exports = function (api) {
  api.cache(true)
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  }
}
```

`apps/mobile/metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

// Expo configures Metro for the monorepo itself (workspace packages such as
// @escritorio/core resolve as TS source); don't add watchFolders here.
const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })
```

`apps/mobile/global.css`. The values are the web theme's tokens (`apps/web/src/index.css`) converted from oklch to RGB:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Mirrors apps/web/src/index.css (oklch → RGB). Dark mode follows the system. */
:root {
  --background: 255 255 255;
  --foreground: 10 10 10;
  --card: 255 255 255;
  --muted: 245 245 245;
  --muted-foreground: 115 115 115;
  --primary: 23 23 23;
  --primary-foreground: 250 250 250;
  --border: 229 229 229;
  --destructive: 231 0 11;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: 10 10 10;
    --foreground: 250 250 250;
    --card: 23 23 23;
    --muted: 38 38 38;
    --muted-foreground: 161 161 161;
    --primary: 229 229 229;
    --primary-foreground: 23 23 23;
    /* Web uses white at 10% alpha; this is its opaque equivalent on --background. */
    --border: 38 38 38;
    --destructive: 255 100 103;
  }
}
```

`apps/mobile/tailwind.config.js`:

```js
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        card: token('card'),
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        border: token('border'),
        destructive: token('destructive'),
      },
    },
  },
}
```

`apps/mobile/nativewind-env.d.ts`:

```ts
/// <reference types="nativewind/types" />
```

`apps/mobile/.env.local.example`:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

(`*.local` is already gitignored at the root, so `apps/mobile/.env.local` stays untracked.)

`apps/mobile/jest.config.js`. Bun installs packages under `node_modules/.bun/<pkg>@<ver>/node_modules/<pkg>`, so `.bun` must be let through jest-expo's ignore list or every package ends up untransformed:

```js
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transformIgnorePatterns: [
    '/node_modules/(?!(\\.bun|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|nativewind|react-native-css-interop))',
  ],
}
```

- [ ] **Step 3: Write the failing smoke test**

`apps/mobile/src/components/Screen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { Screen } from './Screen'

test('renders its children inside a themed screen', () => {
  render(
    <Screen>
      <Text>Hola</Text>
    </Screen>,
  )
  expect(screen.getByText('Hola')).toBeOnTheScreen()
})
```

Run: `bun run --filter @escritorio/mobile test`
Expected: FAIL with "Cannot find module './Screen'". If it fails earlier on a transform or syntax error inside a package, the jest config is wrong; fix `transformIgnorePatterns` before continuing.

- [ ] **Step 4: Implement the Screen component and routes**

`apps/mobile/src/components/Screen.tsx`:

```tsx
import type { ReactNode } from 'react'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'

/** Every screen's root: theme background, safe-area padding. */
export function Screen({ children, edges = ['bottom'] }: { children: ReactNode; edges?: Edge[] }) {
  return (
    <SafeAreaView edges={edges} className="bg-background flex-1">
      {children}
    </SafeAreaView>
  )
}
```

`apps/mobile/src/app/_layout.tsx` (Task 3 replaces this with the auth-gated version):

```tsx
import '../../global.css'
import { Stack } from 'expo-router'

export default function RootLayout() {
  return <Stack />
}
```

`apps/mobile/src/app/index.tsx`:

```tsx
import { Text } from 'react-native'
import { Screen } from '@/components/Screen'

export default function Home() {
  return (
    <Screen>
      <Text className="text-foreground p-4 text-lg">Escritorio</Text>
    </Screen>
  )
}
```

Run: `bun run --filter @escritorio/mobile test && bun run --filter @escritorio/mobile typecheck`
Expected: PASS, and tsc is clean.

- [ ] **Step 5: Verify bundling and root scripts**

```bash
cd apps/mobile && EXPO_PUBLIC_SUPABASE_URL=http://localhost EXPO_PUBLIC_SUPABASE_ANON_KEY=x bun run export:ios && rm -rf dist-export; cd ../..
bun pm why react-native
bun run typecheck && bun run test && bun run lint
```

Expected:
- `expo export` writes an iOS bundle without resolution errors.
- One `react-native` version.
- Root `typecheck` and `test` show `@escritorio/mobile` lines next to core and web, and all pass.
- Lint shows only the 3 existing warnings.

Then add `dist-export` to `apps/mobile/.gitignore` (the template creates that file; append the line).

Check failure propagation: temporarily change `toBeOnTheScreen()` to `not.toBeOnTheScreen()`, then run `bun run test; echo $?`. Expect a non-zero exit. Then revert.

- [ ] **Step 6: Document**

Add to `README.md` under "Repo layout":

```markdown
- `apps/mobile` — the Expo iOS app (`@escritorio/mobile`)
```

Add a new section after "Local development":

```markdown
## Mobile app (iOS)

1. Copy `apps/mobile/.env.local.example` to `apps/mobile/.env.local` and fill
   in the same Supabase URL and anon key as the web app.
2. `bun install`, then `bun run --filter @escritorio/mobile start` and scan
   the QR code with the Expo Go app on your iPhone.
```

- [ ] **Step 7: Commit**

```bash
git add apps/mobile README.md bun.lock
git commit -m "feat(mobile): scaffold Expo app with Expo Router, NativeWind and Jest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Encrypted session storage, Supabase client, token refresh

**Files:**
- Create: `apps/mobile/src/lib/largeSecureStore.ts` (+ `.test.ts`)
- Create: `apps/mobile/src/lib/autoRefresh.ts` (+ `.test.ts`)
- Create: `apps/mobile/src/lib/supabase.ts`, `apps/mobile/src/lib/api.ts`
- Modify: `apps/mobile/package.json` (dependencies via `expo install`)

**Interfaces:**
- Consumes: `createApi` from `@escritorio/core`.
- Produces:
  - `createLargeSecureStore(deps?: { keyStore?: KeyStore; dataStore?: DataStore; randomBytes?: (n: number) => Uint8Array }): SessionStorage`, where `SessionStorage = { getItem(key): Promise<string | null>; setItem(key, value): Promise<void>; removeItem(key): Promise<void> }`
  - `bindAutoRefresh(auth: { startAutoRefresh(): void; stopAutoRefresh(): void }, appState?: AppStateLike): () => void`
  - `supabase: SupabaseClient`, `sessionStorage: SessionStorage`, and `SESSION_STORAGE_KEY = 'escritorio-auth'` from `@/lib/supabase`
  - `api: Api` from `@/lib/api`

- [ ] **Step 1: Install**

From `apps/mobile`:

```bash
bunx expo install @supabase/supabase-js @react-native-async-storage/async-storage expo-secure-store react-native-get-random-values react-native-url-polyfill aes-js
bunx expo install -- --dev @types/aes-js
```

Expected: `ls ../../node_modules/.bun | grep supabase-js` shows a single `@supabase+supabase-js@2.x`. If `expo install` picked a different minor than core's `^2.116.0` and Bun installed two copies, run `bun update @supabase/supabase-js` at the root so both resolve to one.

- [ ] **Step 2: Write the failing storage tests**

`apps/mobile/src/lib/largeSecureStore.test.ts`:

```ts
import { createLargeSecureStore, type DataStore, type KeyStore } from './largeSecureStore'

function memoryStores() {
  const keys = new Map<string, string>()
  const data = new Map<string, string>()
  const keyStore: KeyStore = {
    getItemAsync: async (k) => keys.get(k) ?? null,
    setItemAsync: async (k, v) => void keys.set(k, v),
    deleteItemAsync: async (k) => void keys.delete(k),
  }
  const dataStore: DataStore = {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  }
  return { keys, data, keyStore, dataStore }
}

const SESSION = JSON.stringify({ access_token: 'a'.repeat(3000), user: { id: 'u1' } })

test('round-trips a value larger than the Keychain item limit', async () => {
  const stores = memoryStores()
  const store = createLargeSecureStore(stores)

  await store.setItem('escritorio-auth', SESSION)

  expect(await store.getItem('escritorio-auth')).toBe(SESSION)
})

test('stores only ciphertext in AsyncStorage and only the key in the Keychain', async () => {
  const stores = memoryStores()
  await createLargeSecureStore(stores).setItem('escritorio-auth', SESSION)

  expect(stores.data.get('escritorio-auth')).not.toContain('access_token')
  expect(stores.keys.get('escritorio-auth')).toMatch(/^[0-9a-f]{64}$/)
})

test('returns null when nothing is stored', async () => {
  expect(await createLargeSecureStore(memoryStores()).getItem('escritorio-auth')).toBeNull()
})

test('returns null when the Keychain key is gone but ciphertext remains', async () => {
  const stores = memoryStores()
  const store = createLargeSecureStore(stores)
  await store.setItem('escritorio-auth', SESSION)
  stores.keys.clear()

  expect(await store.getItem('escritorio-auth')).toBeNull()
})

test('returns null when the key does not decrypt the stored data', async () => {
  const stores = memoryStores()
  const store = createLargeSecureStore(stores)
  await store.setItem('escritorio-auth', SESSION)
  stores.keys.set('escritorio-auth', '00'.repeat(32))

  expect(await store.getItem('escritorio-auth')).toBeNull()
})

test('removeItem clears both stores', async () => {
  const stores = memoryStores()
  const store = createLargeSecureStore(stores)
  await store.setItem('escritorio-auth', SESSION)

  await store.removeItem('escritorio-auth')

  expect(stores.data.size).toBe(0)
  expect(stores.keys.size).toBe(0)
})
```

Run: `bun run --filter @escritorio/mobile test -- largeSecureStore`
Expected: FAIL with "Cannot find module './largeSecureStore'".

- [ ] **Step 3: Implement the storage**

`apps/mobile/src/lib/largeSecureStore.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as aesjs from 'aes-js'
import * as SecureStore from 'expo-secure-store'

export interface KeyStore {
  getItemAsync(key: string): Promise<string | null>
  setItemAsync(key: string, value: string): Promise<void>
  deleteItemAsync(key: string): Promise<void>
}

export interface DataStore {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export interface SessionStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

const defaultRandomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))

/**
 * Supabase session storage that fits the Keychain's 2 KB item limit: the
 * session is AES-256-CTR encrypted into AsyncStorage, and only the per-write
 * random key lives in the Keychain (Supabase's LargeSecureStore pattern).
 */
export function createLargeSecureStore({
  keyStore = SecureStore,
  dataStore = AsyncStorage,
  randomBytes = defaultRandomBytes,
}: { keyStore?: KeyStore; dataStore?: DataStore; randomBytes?: (n: number) => Uint8Array } = {}): SessionStorage {
  function cipher(key: Uint8Array) {
    return new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1))
  }

  return {
    async getItem(name) {
      const encrypted = await dataStore.getItem(name)
      if (!encrypted) return null
      const keyHex = await keyStore.getItemAsync(name)
      // A missing key (or one from a different write) can't decrypt the
      // data. Treat it as no session instead of handing auth-js garbage.
      if (!keyHex) return null
      try {
        const bytes = cipher(aesjs.utils.hex.toBytes(keyHex)).decrypt(aesjs.utils.hex.toBytes(encrypted))
        const value = aesjs.utils.utf8.fromBytes(bytes)
        JSON.parse(value)
        return value
      } catch {
        return null
      }
    },

    async setItem(name, value) {
      const key = randomBytes(32)
      const encrypted = cipher(key).encrypt(aesjs.utils.utf8.toBytes(value))
      await keyStore.setItemAsync(name, aesjs.utils.hex.fromBytes(key))
      await dataStore.setItem(name, aesjs.utils.hex.fromBytes(encrypted))
    },

    async removeItem(name) {
      await dataStore.removeItem(name)
      await keyStore.deleteItemAsync(name)
    },
  }
}
```

The `JSON.parse` check is deliberate: auth-js only ever stores JSON. A wrong key produces bytes that aren't valid UTF-8 JSON, so this is how a mismatched key is caught.

Run: `bun run --filter @escritorio/mobile test -- largeSecureStore`
Expected: 6/6 pass.

- [ ] **Step 4: Write the failing auto-refresh tests**

`apps/mobile/src/lib/autoRefresh.test.ts`:

```ts
import type { AppStateStatus } from 'react-native'
import { bindAutoRefresh, type AppStateLike } from './autoRefresh'

function fakeAppState(initial: AppStateStatus) {
  let listener: ((s: AppStateStatus) => void) | undefined
  const appState: AppStateLike = {
    currentState: initial,
    addEventListener: (_event, l) => {
      listener = l
      return { remove: () => (listener = undefined) }
    },
  }
  return { appState, emit: (s: AppStateStatus) => listener?.(s), isBound: () => !!listener }
}

function fakeAuth() {
  return { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() }
}

test('starts refreshing immediately when the app is already active', () => {
  const auth = fakeAuth()
  bindAutoRefresh(auth, fakeAppState('active').appState)
  expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1)
})

test('stops in the background and restarts in the foreground', () => {
  const auth = fakeAuth()
  const { appState, emit } = fakeAppState('active')
  bindAutoRefresh(auth, appState)

  emit('background')
  expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1)
  emit('active')
  expect(auth.startAutoRefresh).toHaveBeenCalledTimes(2)
})

test('unbinding removes the listener', () => {
  const { appState, isBound } = fakeAppState('background')
  const unbind = bindAutoRefresh(fakeAuth(), appState)
  unbind()
  expect(isBound()).toBe(false)
})
```

Run: `bun run --filter @escritorio/mobile test -- autoRefresh`
Expected: FAIL with "Cannot find module './autoRefresh'".

- [ ] **Step 5: Implement auto-refresh, the client and the API**

`apps/mobile/src/lib/autoRefresh.ts`:

```ts
import { AppState, type AppStateStatus } from 'react-native'

export interface AppStateLike {
  currentState: AppStateStatus
  addEventListener(event: 'change', listener: (state: AppStateStatus) => void): { remove(): void }
}

interface Refreshable {
  startAutoRefresh(): void
  stopAutoRefresh(): void
}

/**
 * auth-js only runs its refresh timer by itself in browsers. On native we
 * run it while the app is in the foreground, and stop it in the background
 * so a suspended app doesn't fire refreshes that fail.
 */
export function bindAutoRefresh(auth: Refreshable, appState: AppStateLike = AppState): () => void {
  if (appState.currentState === 'active') auth.startAutoRefresh()
  const subscription = appState.addEventListener('change', (state) => {
    if (state === 'active') auth.startAutoRefresh()
    else auth.stopAutoRefresh()
  })
  return () => subscription.remove()
}
```

`apps/mobile/src/lib/supabase.ts`:

```ts
import 'react-native-get-random-values'
import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import { createLargeSecureStore } from './largeSecureStore'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy apps/mobile/.env.local.example to apps/mobile/.env.local and fill in your Supabase project values.',
  )
}

// Fixed (rather than auth-js's project-derived default) so the offline
// sign-in check in AuthProvider can read the stored session itself.
export const SESSION_STORAGE_KEY = 'escritorio-auth'

export const sessionStorage = createLargeSecureStore()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sessionStorage,
    storageKey: SESSION_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
```

`apps/mobile/src/lib/api.ts`:

```ts
import { createApi } from '@escritorio/core'
import { supabase } from './supabase'

export const api = createApi(supabase)
```

Run: `bun run --filter @escritorio/mobile test && bun run --filter @escritorio/mobile typecheck`
Expected: 10/10 pass (1 smoke + 6 storage + 3 auto-refresh), and tsc is clean.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile bun.lock
git commit -m "feat(mobile): encrypted session storage and Supabase client

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Offline-first auth gating and sign-in screen

**Files:**
- Create: `apps/mobile/src/features/auth/AuthProvider.tsx` (+ `.test.tsx`)
- Create: `apps/mobile/src/features/auth/storedUser.ts`
- Create: `apps/mobile/src/features/auth/SignInScreen.tsx` (+ `.test.tsx`)
- Create: `apps/mobile/src/config.ts`
- Create: `apps/mobile/src/app/(app)/_layout.tsx`, `apps/mobile/src/app/sign-in.tsx`
- Move: `apps/mobile/src/app/index.tsx` → `apps/mobile/src/app/(app)/index.tsx`
- Modify: `apps/mobile/src/app/_layout.tsx`

**Interfaces:**
- Consumes: `supabase`, `sessionStorage`, `SESSION_STORAGE_KEY` and `bindAutoRefresh` from Task 2. `authSchema` from core.
- Produces:
  - `AuthProvider({ auth, readStoredUser, children })`
  - `useAuth(): AuthState`, where `AuthState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: StoredUser }` and `StoredUser = { id: string; email: string | null }`
  - `readStoredUser(storage, key): Promise<StoredUser | null>`
  - `WEB_APP_URL` and `WEB_SIGN_UP_URL` from `@/config`

- [ ] **Step 1: Write the failing AuthProvider tests**

`apps/mobile/src/features/auth/AuthProvider.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react-native'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { Text } from 'react-native'
import { AuthProvider, useAuth, type AuthLike } from './AuthProvider'
import { readStoredUser } from './storedUser'

function fakeAuth() {
  let callback: ((event: AuthChangeEvent, session: Session | null) => void) | undefined
  const auth: AuthLike = {
    onAuthStateChange: (cb) => {
      callback = cb
      return { data: { subscription: { unsubscribe: () => (callback = undefined) } } }
    },
  }
  return { auth, emit: (event: AuthChangeEvent, session: Session | null) => callback?.(event, session) }
}

function Status() {
  const state = useAuth()
  return <Text>{state.status === 'signedIn' ? `in:${state.user.id}` : state.status}</Text>
}

const session = { user: { id: 'u1', email: 'a@b.c' } } as Session

test('a stored session counts as signed in even when auth-js reports none (offline, expired token)', async () => {
  const { auth, emit } = fakeAuth()
  render(
    <AuthProvider auth={auth} readStoredUser={async () => ({ id: 'u1', email: 'a@b.c' })}>
      <Status />
    </AuthProvider>,
  )

  // getSession() fails to refresh offline, so auth-js reports a null initial session.
  act(() => emit('INITIAL_SESSION', null))

  expect(await screen.findByText('in:u1')).toBeOnTheScreen()
})

test('no stored session means signed out', async () => {
  render(
    <AuthProvider auth={fakeAuth().auth} readStoredUser={async () => null}>
      <Status />
    </AuthProvider>,
  )
  expect(await screen.findByText('signedOut')).toBeOnTheScreen()
})

test('signing in and out updates the state', async () => {
  const { auth, emit } = fakeAuth()
  render(
    <AuthProvider auth={auth} readStoredUser={async () => null}>
      <Status />
    </AuthProvider>,
  )
  await screen.findByText('signedOut')

  act(() => emit('SIGNED_IN', session))
  expect(screen.getByText('in:u1')).toBeOnTheScreen()

  // Also what auth-js emits when the refresh token is rejected online.
  act(() => emit('SIGNED_OUT', null))
  expect(screen.getByText('signedOut')).toBeOnTheScreen()
})

describe('readStoredUser', () => {
  const storage = (value: string | null) => ({ getItem: async () => value, setItem: async () => {}, removeItem: async () => {} })

  test('reads the user from the stored session', async () => {
    const stored = JSON.stringify({ access_token: 'expired', refresh_token: 'r', user: { id: 'u1', email: 'a@b.c' } })
    expect(await readStoredUser(storage(stored), 'k')).toEqual({ id: 'u1', email: 'a@b.c' })
  })

  test('returns null for nothing stored, unparseable data, or no user', async () => {
    expect(await readStoredUser(storage(null), 'k')).toBeNull()
    expect(await readStoredUser(storage('not json'), 'k')).toBeNull()
    expect(await readStoredUser(storage('{"access_token":"x"}'), 'k')).toBeNull()
  })
})
```

Run: `bun run --filter @escritorio/mobile test -- AuthProvider`
Expected: FAIL with "Cannot find module './AuthProvider'".

- [ ] **Step 2: Implement**

`apps/mobile/src/features/auth/storedUser.ts`:

```ts
import type { SessionStorage } from '@/lib/largeSecureStore'

export interface StoredUser {
  id: string
  email: string | null
}

/**
 * The user from the session auth-js persisted, whether or not its access
 * token is still valid. This is the offline sign-in check: getSession()
 * returns null when the token has expired and can't be refreshed (no
 * network), but the learner is still signed in.
 */
export async function readStoredUser(storage: SessionStorage, key: string): Promise<StoredUser | null> {
  const raw = await storage.getItem(key)
  if (!raw) return null
  try {
    const user = (JSON.parse(raw) as { user?: { id?: string; email?: string | null } }).user
    return user?.id ? { id: user.id, email: user.email ?? null } : null
  } catch {
    return null
  }
}
```

`apps/mobile/src/features/auth/AuthProvider.tsx`:

```tsx
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { StoredUser } from './storedUser'

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: StoredUser }

export interface AuthLike {
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): {
    data: { subscription: { unsubscribe(): void } }
  }
}

const AuthContext = createContext<AuthState>({ status: 'loading' })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

/**
 * Signed in = a session is stored on the device (see readStoredUser).
 * After that, only explicit auth events change it: SIGNED_OUT comes from
 * a sign-out, or from auth-js rejecting the refresh token online. A null
 * INITIAL_SESSION is ignored, because offline it only means "couldn't
 * refresh yet".
 */
export function AuthProvider({
  auth,
  readStoredUser,
  children,
}: {
  auth: AuthLike
  readStoredUser: () => Promise<StoredUser | null>
  children: ReactNode
}) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    readStoredUser().then((user) => {
      if (cancelled) return
      setState((current) =>
        current.status !== 'loading' ? current : user ? { status: 'signedIn', user } : { status: 'signedOut' },
      )
    })

    const { data } = auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setState({ status: 'signedOut' })
      } else if (session?.user && event !== 'INITIAL_SESSION') {
        setState({ status: 'signedIn', user: { id: session.user.id, email: session.user.email ?? null } })
      }
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [auth, readStoredUser])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
```

Run: `bun run --filter @escritorio/mobile test -- AuthProvider`
Expected: 5/5 pass.

- [ ] **Step 3: Write the failing sign-in screen tests**

`apps/mobile/src/config.ts`:

```ts
// The web app (GitHub Pages, HashRouter) handles everything mobile v1
// doesn't: account creation, editing.
export const WEB_APP_URL = 'https://mrdavidrios.github.io/escritorio/'
export const WEB_SIGN_UP_URL = `${WEB_APP_URL}#/signup`
```

`apps/mobile/src/features/auth/SignInScreen.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { WEB_SIGN_UP_URL } from '@/config'
import { SignInScreen } from './SignInScreen'

function setup(result: { error: { message: string } | null } = { error: null }) {
  const signIn = jest.fn().mockResolvedValue(result)
  render(<SignInScreen signIn={signIn} />)
  return { signIn }
}

function fill(email: string, password: string) {
  fireEvent.changeText(screen.getByLabelText('Email'), email)
  fireEvent.changeText(screen.getByLabelText('Password'), password)
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }))
}

test('signs in with the entered email and password', async () => {
  const { signIn } = setup()
  fill('learner@example.com', 'secret123')
  expect(signIn).toHaveBeenCalledWith({ email: 'learner@example.com', password: 'secret123' })
})

test('shows validation errors from the shared auth schema without calling Supabase', async () => {
  const { signIn } = setup()
  fill('not-an-email', '123')
  expect(await screen.findByText('Enter a valid email address')).toBeOnTheScreen()
  expect(screen.getByText('Password must be at least 6 characters')).toBeOnTheScreen()
  expect(signIn).not.toHaveBeenCalled()
})

test('shows the Supabase error when sign-in fails', async () => {
  setup({ error: { message: 'Invalid login credentials' } })
  fill('learner@example.com', 'wrongpass')
  expect(await screen.findByText('Invalid login credentials')).toBeOnTheScreen()
})

test('"Create an account" opens the web app', () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
  setup()
  fireEvent.press(screen.getByRole('link', { name: 'Create an account' }))
  expect(open).toHaveBeenCalledWith(WEB_SIGN_UP_URL)
})
```

Run: `bun run --filter @escritorio/mobile test -- SignInScreen`
Expected: FAIL with "Cannot find module './SignInScreen'".

- [ ] **Step 4: Implement the screen and gate the routes**

`apps/mobile/src/features/auth/SignInScreen.tsx`:

```tsx
import { authSchema, type AuthFormValues } from '@escritorio/core'
import { useState } from 'react'
import { KeyboardAvoidingView, Linking, Pressable, Text, TextInput, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { WEB_SIGN_UP_URL } from '@/config'

type SignIn = (values: AuthFormValues) => Promise<{ error: { message: string } | null }>
type FieldErrors = Partial<Record<keyof AuthFormValues, string>>

export function SignInScreen({ signIn }: { signIn: SignIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    const parsed = authSchema.safeParse({ email: email.trim(), password })
    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof AuthFormValues
        errors[field] ??= issue.message
      }
      setFieldErrors(errors)
      return
    }
    setFieldErrors({})
    setFormError(null)
    setSubmitting(true)
    const { error } = await signIn(parsed.data)
    setSubmitting(false)
    if (error) setFormError(error.message)
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-center gap-4 px-6">
        <Text className="text-foreground text-3xl font-bold">Escritorio</Text>

        <View className="gap-1">
          <TextInput
            accessibilityLabel="Email"
            placeholder="Email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            className="border-border text-foreground rounded-lg border px-3 py-3 text-base"
          />
          {fieldErrors.email && <Text className="text-destructive text-sm">{fieldErrors.email}</Text>}
        </View>

        <View className="gap-1">
          <TextInput
            accessibilityLabel="Password"
            placeholder="Password"
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            value={password}
            onChangeText={setPassword}
            className="border-border text-foreground rounded-lg border px-3 py-3 text-base"
          />
          {fieldErrors.password && <Text className="text-destructive text-sm">{fieldErrors.password}</Text>}
        </View>

        {formError && <Text className="text-destructive text-sm">{formError}</Text>}

        <Pressable
          accessibilityRole="button"
          disabled={submitting}
          onPress={submit}
          className="bg-primary items-center rounded-lg py-3 disabled:opacity-50"
        >
          <Text className="text-primary-foreground text-base font-semibold">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Text>
        </Pressable>

        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(WEB_SIGN_UP_URL)}>
          <Text className="text-muted-foreground text-center text-sm underline">Create an account</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  )
}
```

The button's accessible name comes from its text. While submitting, the text reads "Signing in…", so the tests press it in its idle state.

`apps/mobile/src/app/sign-in.tsx`:

```tsx
import { SignInScreen } from '@/features/auth/SignInScreen'
import { supabase } from '@/lib/supabase'

export default function SignInRoute() {
  return <SignInScreen signIn={(values) => supabase.auth.signInWithPassword(values)} />
}
```

Move the home screen into the signed-in group:

```bash
mkdir -p 'apps/mobile/src/app/(app)'
git mv apps/mobile/src/app/index.tsx 'apps/mobile/src/app/(app)/index.tsx'
```

`apps/mobile/src/app/(app)/_layout.tsx`:

```tsx
import { Stack } from 'expo-router'

export default function SignedInLayout() {
  return <Stack />
}
```

Replace `apps/mobile/src/app/_layout.tsx`:

```tsx
import '../../global.css'
import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import { readStoredUser } from '@/features/auth/storedUser'
import { bindAutoRefresh } from '@/lib/autoRefresh'
import { SESSION_STORAGE_KEY, sessionStorage, supabase } from '@/lib/supabase'

const readUser = () => readStoredUser(sessionStorage, SESSION_STORAGE_KEY)

function Routes() {
  const auth = useAuth()
  // Keep the splash screen (nothing rendered) until the stored session has been read.
  if (auth.status === 'loading') return null
  const signedIn = auth.status === 'signedIn'
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  useEffect(() => bindAutoRefresh(supabase.auth), [])
  return (
    <AuthProvider auth={supabase.auth} readStoredUser={readUser}>
      <Routes />
    </AuthProvider>
  )
}
```

Run: `bun run --filter @escritorio/mobile test && bun run --filter @escritorio/mobile typecheck`
Expected: 19/19 pass (10 + 5 AuthProvider + 4 SignInScreen), and tsc is clean. If `Stack.Protected` doesn't typecheck, check `node_modules/expo-router` for the gating API this version exports. Use it, and record a ruling.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): offline-first sign-in gating and sign-in screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Set list and set detail (online)

**Files:**
- Create: `apps/mobile/src/lib/queryClient.ts`
- Create: `apps/mobile/src/features/sets/hooks.ts`
- Create: `apps/mobile/src/features/sets/SetListScreen.tsx` (+ `.test.tsx`)
- Create: `apps/mobile/src/features/sets/SetDetailScreen.tsx` (+ `.test.tsx`)
- Create: `apps/mobile/src/test/renderWithQuery.tsx`
- Create: `apps/mobile/src/app/(app)/sets/[id].tsx`
- Modify: `apps/mobile/src/app/(app)/index.tsx`, `apps/mobile/src/app/(app)/_layout.tsx`, `apps/mobile/src/app/_layout.tsx`
- Modify (deps): `bunx expo install @tanstack/react-query expo-image`

**Interfaces:**
- Consumes: `api` (Task 2), `supabase` (Task 2), and `queryKeys`, `StudySetSummary`, `StudySet`, `Card` from core.
- Produces:
  - `useStudySets()`, `useStudySet(id)`, `useCards(studySetId)` and `useSignedImageUrl(path)` (TanStack Query hooks keyed by core's `queryKeys`). DR-15 will make these offline-aware.
  - `SetListScreen({ onOpenSet, onSignOut })`
  - `SetDetailScreen({ id })`

- [ ] **Step 1: Install and add test helpers**

From `apps/mobile`: `bunx expo install @tanstack/react-query expo-image`. Check that `bun pm why @tanstack/react-query` shows the same major (5) as web.

`apps/mobile/src/lib/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000 } },
})
```

`apps/mobile/src/test/renderWithQuery.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react-native'
import type { ReactElement } from 'react'

export function renderWithQuery(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}
```

- [ ] **Step 2: Write the failing screen tests**

`apps/mobile/src/features/sets/SetListScreen.test.tsx`:

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

beforeEach(() => listStudySets.mockReset())

test("lists the learner's sets and opens one when tapped", async () => {
  listStudySets.mockResolvedValue([set('s1', 'Verbos', 'Common verbs'), set('s2', 'Comida')])
  const onOpenSet = jest.fn()
  renderWithQuery(<SetListScreen onOpenSet={onOpenSet} onSignOut={jest.fn()} />)

  fireEvent.press(await screen.findByText('Verbos'))

  expect(screen.getByText('Common verbs')).toBeOnTheScreen()
  expect(screen.getByText('Comida')).toBeOnTheScreen()
  expect(onOpenSet).toHaveBeenCalledWith('s1')
})

test('shows an empty state that points to the web app', async () => {
  listStudySets.mockResolvedValue([])
  renderWithQuery(<SetListScreen onOpenSet={jest.fn()} onSignOut={jest.fn()} />)
  expect(await screen.findByText(/No study sets yet/)).toBeOnTheScreen()
})

test('shows an error with a retry that refetches', async () => {
  listStudySets.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce([set('s1', 'Verbos')])
  renderWithQuery(<SetListScreen onOpenSet={jest.fn()} onSignOut={jest.fn()} />)

  fireEvent.press(await screen.findByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('Verbos')).toBeOnTheScreen()
})

test('sign out is offered', async () => {
  listStudySets.mockResolvedValue([])
  const onSignOut = jest.fn()
  renderWithQuery(<SetListScreen onOpenSet={jest.fn()} onSignOut={onSignOut} />)
  fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }))
  expect(onSignOut).toHaveBeenCalled()
})
```

`apps/mobile/src/features/sets/SetDetailScreen.test.tsx`:

```tsx
import { screen } from '@testing-library/react-native'
import { api } from '@/lib/api'
import { renderWithQuery } from '@/test/renderWithQuery'
import { SetDetailScreen } from './SetDetailScreen'

jest.mock('@/lib/api', () => ({
  api: {
    studySets: { getStudySet: jest.fn() },
    cards: { listCards: jest.fn() },
    cardImages: { getSignedImageUrl: jest.fn() },
  },
}))

const card = (id: string, spanish_term: string, extra: Record<string, unknown> = {}) => ({
  id,
  study_set_id: 's1',
  spanish_term,
  english_equivalent: null,
  definition: null,
  hint: null,
  image_path: null,
  position: 0,
  ...extra,
})

beforeEach(() => {
  jest.mocked(api.studySets.getStudySet).mockResolvedValue({ id: 's1', title: 'Verbos', description: 'Common verbs' } as never)
  jest.mocked(api.cardImages.getSignedImageUrl).mockResolvedValue('https://example.test/img.webp')
})

test('shows the title, card count and a read-only card preview', async () => {
  jest.mocked(api.cards.listCards).mockResolvedValue([
    card('c1', 'hablar', { english_equivalent: 'to speak' }),
    card('c2', 'comer', { definition: 'ingerir alimentos', image_path: 'u/c2.webp' }),
  ] as never)

  renderWithQuery(<SetDetailScreen id="s1" />)

  expect(await screen.findByText('Verbos')).toBeOnTheScreen()
  expect(await screen.findByText('2 cards')).toBeOnTheScreen()
  expect(screen.getByText('hablar')).toBeOnTheScreen()
  expect(screen.getByText('to speak')).toBeOnTheScreen()
  expect(screen.getByText('ingerir alimentos')).toBeOnTheScreen()
  expect(api.cardImages.getSignedImageUrl).toHaveBeenCalledWith('u/c2.webp')
})

test('uses the singular for one card', async () => {
  jest.mocked(api.cards.listCards).mockResolvedValue([card('c1', 'hablar')] as never)
  renderWithQuery(<SetDetailScreen id="s1" />)
  expect(await screen.findByText('1 card')).toBeOnTheScreen()
})
```

Run: `bun run --filter @escritorio/mobile test -- features/sets`
Expected: FAIL with "Cannot find module './SetListScreen'" / "'./SetDetailScreen'".

- [ ] **Step 3: Implement the hooks and screens**

`apps/mobile/src/features/sets/hooks.ts`:

```ts
import { queryKeys } from '@escritorio/core'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Online-only for now; DR-15 persists this cache and mirrors images for offline use.
export function useStudySets() {
  return useQuery({ queryKey: queryKeys.studySets(), queryFn: api.studySets.listStudySets })
}

export function useStudySet(id: string) {
  return useQuery({ queryKey: queryKeys.studySet(id), queryFn: () => api.studySets.getStudySet(id) })
}

export function useCards(studySetId: string) {
  return useQuery({ queryKey: queryKeys.cards(studySetId), queryFn: () => api.cards.listCards(studySetId) })
}

export function useSignedImageUrl(path: string | null) {
  return useQuery({
    queryKey: queryKeys.signedImageUrl(path ?? ''),
    queryFn: () => api.cardImages.getSignedImageUrl(path!),
    enabled: path != null,
  })
}
```

`apps/mobile/src/features/sets/SetListScreen.tsx`:

```tsx
import type { StudySetSummary } from '@escritorio/core'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { useStudySets } from './hooks'

export function SetListScreen({
  onOpenSet,
  onSignOut,
}: {
  onOpenSet: (id: string) => void
  onSignOut: () => void
}) {
  const { data, error, isPending, isRefetching, refetch } = useStudySets()

  return (
    <Screen>
      <FlatList<StudySetSummary>
        contentInsetAdjustmentBehavior="automatic"
        data={data ?? []}
        keyExtractor={(set) => set.id}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => onOpenSet(item.id)}
            className="border-border border-b px-4 py-4 active:opacity-60"
          >
            <Text className="text-foreground text-lg font-semibold">{item.title}</Text>
            {item.description ? <Text className="text-muted-foreground">{item.description}</Text> : null}
          </Pressable>
        )}
        ListEmptyComponent={
          isPending ? null : error ? (
            <View className="items-center gap-3 p-8">
              <Text className="text-muted-foreground text-center">Couldn't load your study sets.</Text>
              <Pressable accessibilityRole="button" onPress={() => refetch()} className="bg-primary rounded-lg px-4 py-2">
                <Text className="text-primary-foreground font-semibold">Try again</Text>
              </Pressable>
            </View>
          ) : (
            <Text className="text-muted-foreground p-8 text-center">
              No study sets yet. Create one in the web app.
            </Text>
          )
        }
        ListFooterComponent={
          <Pressable accessibilityRole="button" onPress={onSignOut} className="items-center p-6">
            <Text className="text-muted-foreground underline">Sign out</Text>
          </Pressable>
        }
      />
    </Screen>
  )
}
```

`apps/mobile/src/features/sets/SetDetailScreen.tsx`:

```tsx
import type { Card } from '@escritorio/core'
import { Image } from 'expo-image'
import { FlatList, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { useCards, useSignedImageUrl, useStudySet } from './hooks'

function CardRow({ card }: { card: Card }) {
  const { data: imageUrl } = useSignedImageUrl(card.image_path)
  const meaning = card.english_equivalent ?? card.definition
  return (
    <View className="border-border flex-row items-center gap-3 border-b px-4 py-3">
      {card.image_path ? (
        <Image source={imageUrl ? { uri: imageUrl } : null} style={{ width: 48, height: 48, borderRadius: 8 }} contentFit="cover" />
      ) : null}
      <View className="flex-1">
        <Text className="text-foreground text-base font-medium">{card.spanish_term}</Text>
        {meaning ? <Text className="text-muted-foreground">{meaning}</Text> : null}
      </View>
    </View>
  )
}

export function SetDetailScreen({ id }: { id: string }) {
  const { data: studySet } = useStudySet(id)
  const { data: cards } = useCards(id)
  const count = cards?.length

  return (
    <Screen>
      <FlatList<Card>
        contentInsetAdjustmentBehavior="automatic"
        data={cards ?? []}
        keyExtractor={(card) => card.id}
        ListHeaderComponent={
          <View className="gap-1 px-4 py-4">
            <Text className="text-foreground text-2xl font-bold">{studySet?.title ?? ''}</Text>
            {studySet?.description ? <Text className="text-muted-foreground">{studySet.description}</Text> : null}
            {count != null ? <Text className="text-muted-foreground">{count === 1 ? '1 card' : `${count} cards`}</Text> : null}
          </View>
        }
        renderItem={({ item }) => <CardRow card={item} />}
      />
    </Screen>
  )
}
```

Run: `bun run --filter @escritorio/mobile test -- features/sets`
Expected: 6/6 pass. `screen.findByText('Verbos')` in the list test also confirms the item's text sits inside the pressable.

- [ ] **Step 4: Wire routes and providers**

In `apps/mobile/src/app/_layout.tsx`:
- Add these imports:
  ```tsx
  import { QueryClientProvider } from '@tanstack/react-query'
  import { queryClient } from '@/lib/queryClient'
  ```
- Wrap `<AuthProvider …>` in `<QueryClientProvider client={queryClient}>…</QueryClientProvider>`.

Replace `apps/mobile/src/app/(app)/_layout.tsx`:

```tsx
import { Stack } from 'expo-router'

export default function SignedInLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Study sets', headerLargeTitle: true }} />
      <Stack.Screen name="sets/[id]" options={{ title: '' }} />
    </Stack>
  )
}
```

Replace `apps/mobile/src/app/(app)/index.tsx`:

```tsx
import { useRouter } from 'expo-router'
import { SetListScreen } from '@/features/sets/SetListScreen'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'

export default function SetListRoute() {
  const router = useRouter()
  return (
    <SetListScreen
      onOpenSet={(id) => router.push({ pathname: '/sets/[id]', params: { id } })}
      onSignOut={async () => {
        // Temporary until Settings (DR-15) owns sign-out and the outbox warning.
        await supabase.auth.signOut()
        queryClient.clear()
      }}
    />
  )
}
```

`apps/mobile/src/app/(app)/sets/[id].tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router'
import { SetDetailScreen } from '@/features/sets/SetDetailScreen'

export default function SetDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <SetDetailScreen id={id} />
}
```

- [ ] **Step 5: Full verification**

```bash
bun run typecheck && bun run test && bun run lint && bun run build
cd apps/mobile && EXPO_PUBLIC_SUPABASE_URL=http://localhost EXPO_PUBLIC_SUPABASE_ANON_KEY=x bun run export:ios && rm -rf dist-export; cd ../..
```

Expected:
- Everything passes (mobile 25 tests), and lint shows only the 3 existing warnings.
- The iOS export bundles, which proves Metro resolves `@escritorio/core`, its `api/` and `@supabase/supabase-js`.
- The web build is unaffected.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile bun.lock
git commit -m "feat(mobile): study set list and set detail screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After the tasks

- Run the final whole-branch review from the DR-11 branch tip: `git merge-base feat/dr-11-ios-26-core-api-changes-client-injection-offline-safe HEAD`.
- Publish with `gh stack submit --auto --open`, then set the PR title and description. Link the PR on Linear DR-12 and move it to In Review.
- The PR description must ask for an on-device check, because this machine has no iOS simulator:
  - `bun run --filter @escritorio/mobile start` → Expo Go → sign in → the set list loads → open a set → card images appear.
  - Kill the app, turn on airplane mode, relaunch: it must open on the set list, not sign-in. The list itself will fail to load offline until DR-15.
  - Sign out → back to sign-in.
