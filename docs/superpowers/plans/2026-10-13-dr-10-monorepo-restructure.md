# DR-10: Monorepo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the repo into a Bun-workspaces monorepo. The web app moves to `apps/web`, and its pure domain code (types, grading, study modes, schemas, dictionary API, query keys) is extracted into `packages/core` (`@escritorio/core`). The web app's behaviour must not change.

**Architecture:**

- **Web app:** moved with `git mv` so `git log --follow` keeps history.
- **Shared tooling:** Prettier and oxlint stay at the repo root and cover every workspace.
- **Per-workspace tooling:** each workspace owns its own `tsc`, `vite` and `vitest`, and root scripts fan out to every workspace with `bun run --filter`.
- **Core package:** shipped as TypeScript source through a single barrel (`src/index.ts`), with no build step. Vite compiles it as part of the web build.

**Tech Stack:** Bun 1.3 workspaces, Vite 8, TypeScript 6, Vitest 5, oxlint, Prettier, GitHub Actions (Pages).

**Spec:** `docs/superpowers/specs/2026-10-13-ios-app-design.md`. This plan implements rollout step 1 ("Monorepo restructure") and the "Repo structure" section. Linear: DR-10.

## Global Constraints

- Workspaces: root `package.json` `"workspaces": ["apps/*", "packages/*"]`.
- Core package name: `@escritorio/core`. It's consumed as TS source via package `exports`, with no build step.
- Core contains no React, no DOM and no React Native imports: pure TypeScript plus `zod`. Its `tsconfig` must not include the `DOM` lib.
- Core's internal imports are relative (no `@/` alias).
- `supabase/migrations/` stays at the repo root, unchanged.
- **Out of scope until DR-11:** `src/api/*` stays in `apps/web`. It imports the web app's Supabase client directly, and moving it requires the client-injection change.
- Web behaviour unchanged. The Pages URL base stays `/escritorio/`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Env loading after the move:** `.env.local` (untracked) must live in `apps/web/`, or `bun run dev` throws "Missing VITE_SUPABASE_URL…". Task 1, Step 6 moves it, and Step 9 checks that the dev server starts.
2. **Failures propagate through `--filter`:** a failing test or typecheck in _any_ workspace must make the root `bun run test` / `bun run build` exit non-zero, or CI goes green on broken code. Task 3, Step 3 breaks a core test on purpose and checks the exit code.
3. **Fresh-clone CI:** `bun install --frozen-lockfile` must succeed against the regenerated `bun.lock`. Task 3, Step 4 runs it from a clean `node_modules`.
4. **Pages artifact path:** the deploy uploads `apps/web/dist`. If the path is wrong, the deploy succeeds but serves nothing or stale files. Task 3, Step 5 builds and lists `apps/web/dist/index.html`.
5. **Core leaking DOM:** `dictionaryApi.ts` uses `fetch` and `Response`. These have to typecheck without the DOM lib, so React Native can consume the package later. Task 2, Step 9 runs core's own `tsc` with `lib: ["ES2023"]` only.

---

## File map

| Path                                                                               | Change                                                                                  |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `package.json`                                                                     | Rewritten as the workspace root (scripts fan out, shared lint/format devDeps)           |
| `apps/web/package.json`                                                            | New: the web app's former deps and scripts, named `@escritorio/web`                     |
| `apps/web/{index.html,vite.config.ts,tsconfig*.json,components.json,public/,src/}` | Moved from the root with `git mv`                                                       |
| `.oxlintrc.json`                                                                   | `$schema` path is unchanged (oxlint stays a root devDep)                                |
| `packages/core/package.json`, `tsconfig.json`                                      | New                                                                                     |
| `packages/core/src/index.ts`                                                       | New barrel                                                                              |
| `packages/core/src/types/*`                                                        | ← `src/types/*`                                                                         |
| `packages/core/src/grading.ts` (+ `.test.ts`)                                      | ← `src/lib/grading.ts`                                                                  |
| `packages/core/src/studyMode.ts` (+ `.test.ts`)                                    | ← `src/features/study/studyMode.ts`                                                     |
| `packages/core/src/schemas/{card,studySet,auth}Schema.ts`                          | ← `src/features/study-sets/{card,studySet}Schema.ts`, `src/features/auth/authSchema.ts` |
| `packages/core/src/dictionaryApi.ts` (+ `.test.ts`)                                | ← `src/features/study-sets/dictionaryApi.ts`                                            |
| `packages/core/src/queryKeys.ts` (+ `.test.ts`)                                    | New: replaces `studySetsKey`, `studySetKey`, `cardsKey` and two inline keys             |
| `apps/web/src/**`                                                                  | Imports rewritten to `@escritorio/core`                                                 |
| `.github/workflows/deploy.yml`                                                     | Uploads `apps/web/dist`; root scripts unchanged in name                                 |
| `README.md`                                                                        | Layout and `.env.local` location updated                                                |

---

### Task 1: Move the web app into `apps/web` and set up the workspace root

**Files:**

- Move: `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `components.json`, `public/`, `src/` → `apps/web/`
- Create: `apps/web/package.json`
- Modify: `package.json`, `bun.lock` (regenerated)

**Interfaces:**

- Produces: root scripts `dev`, `build`, `test`, `lint`, `format`, `format:check`, `typecheck`, all of which work from the repo root. Workspace `@escritorio/web` has scripts `dev`, `build`, `test`, `preview`, `typecheck`.

- [ ] **Step 1: Branch from `develop`**

```bash
git checkout develop && git pull
git checkout -b mrdaverios/dr-10-ios-16-monorepo-restructure-appsweb-packagescore
```

- [ ] **Step 2: Record the baseline (everything must pass before the move)**

Run: `bun run lint && bun run test && bun run build`
Expected: all three succeed. Note the test count from Vitest's summary (e.g. "Tests 57 passed"). Step 9 compares against it.

- [ ] **Step 3: Move the web app with history**

```bash
mkdir -p apps/web
git mv index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json components.json public src apps/web/
```

- [ ] **Step 4: Create `apps/web/package.json`**

These are the former root `dependencies` and the app-specific devDependencies, with versions copied exactly from the current root `package.json`:

```json
{
  "name": "@escritorio/web",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b",
    "test": "vitest run",
    "preview": "vite preview"
  },
  "dependencies": {
    "@floating-ui/dom": "^1.8.0",
    "@fontsource-variable/geist": "^5.3.0",
    "@hookform/resolvers": "^5.9.1",
    "@supabase/supabase-js": "^2.116.0",
    "@tailwindcss/vite": "^4.3.3",
    "@tanstack/react-query": "^5.102.8",
    "class-variance-authority": "^0.7.1",
    "cn": "^0.3.0",
    "lucide-react": "^1.46.0",
    "radix-ui": "^1.6.7",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-hook-form": "^7.88.0",
    "react-router-dom": "^7.18.3",
    "shadcn": "^4.21.0",
    "tailwindcss": "^4.3.3",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@types/node": "^24.13.3",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.7",
    "@vitejs/plugin-react": "^6.1.1",
    "typescript": "~6.0.2",
    "vite": "^8.3.0",
    "vitest": "^5.0.0"
  }
}
```

`vitest run` exits with an error when it finds no test files. After Task 2, `apps/web` keeps no tests of its own, so Task 2 changes this script to `vitest run --passWithNoTests`.

- [ ] **Step 5: Rewrite the root `package.json` as the workspace root**

```json
{
  "name": "escritorio",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "bun run --filter @escritorio/web dev",
    "build": "bun run --filter '*' typecheck && bun run --filter @escritorio/web build",
    "typecheck": "bun run --filter '*' typecheck",
    "test": "bun run --filter '*' test",
    "lint": "oxlint",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "devDependencies": {
    "oxlint": "^1.81.0",
    "prettier": "^3.9.6",
    "prettier-plugin-tailwindcss": "^0.8.1"
  }
}
```

`.oxlintrc.json`, `.prettierrc.json` and `.prettierignore` stay at the root and need no edits. oxlint and Prettier walk the whole tree, and `dist` in `.prettierignore` matches `apps/web/dist`.

- [ ] **Step 6: Move your local env file (untracked, so not in git)**

```bash
[ -f .env.local ] && mv .env.local apps/web/.env.local
git mv .env.local.example apps/web/.env.local.example
```

Vite reads env files from its project root, `apps/web/`. `vite.config.ts` calls `loadEnv(mode, process.cwd(), '')`, and `bun run --filter` runs scripts with the workspace as the working directory, so `VITE_DEV_PORT` still resolves.

- [ ] **Step 7: Reinstall to regenerate `bun.lock`**

```bash
rm -rf node_modules apps/web/node_modules
bun install
```

Expected: install succeeds, and `bun.lock` now lists the `apps/web` workspace.

- [ ] **Step 8: Verify build, typecheck and lint from the root**

Run: `bun run build`
Expected: succeeds, and `apps/web/dist/index.html` exists.

Run: `bun run lint`
Expected: same result as the baseline (no new warnings).

Run: `bun run test`
Expected: the same number of tests pass as in the Step 2 baseline.

- [ ] **Step 9: Verify the dev server finds its env**

Run: `bun run dev`, open the printed URL (port from `VITE_DEV_PORT`, default 5173), and confirm the sign-in page renders with no "Missing VITE_SUPABASE_URL" error in the console. Stop the server.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: move web app into apps/web as a Bun workspace

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then confirm history followed the move: `git log --follow --oneline apps/web/src/lib/grading.ts | head -3` shows commits from before this one.

---

### Task 2: Extract `@escritorio/core` and point the web app at it

**Files:**

- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`, `packages/core/src/queryKeys.ts`, `packages/core/src/queryKeys.test.ts`, `packages/core/src/index.test.ts`
- Move (`git mv`): `apps/web/src/types/*` → `packages/core/src/types/`. `apps/web/src/lib/grading.ts` and `grading.test.ts` → `packages/core/src/`. `apps/web/src/features/study/studyMode.ts` and `studyMode.test.ts` → `packages/core/src/`. `apps/web/src/features/study-sets/dictionaryApi.ts` and `dictionaryApi.test.ts` → `packages/core/src/`. The three schemas → `packages/core/src/schemas/`.
- Modify: `apps/web/package.json` (adds the core dependency and `--passWithNoTests`), `apps/web/src/features/study-sets/hooks/useStudySets.ts`, `useCards.ts`, `useSignedImageUrls.ts`, `useStudySetFallbackImagePaths.ts`, and every file importing a moved module (found by grep in Step 7)

**Interfaces:**

- Consumes: the workspace root from Task 1.
- Produces, all importable from `'@escritorio/core'`:
  - **Everything previously exported by** `types/card`, `types/quizAttempt`, `types/studySession`, `types/studySet`, `grading`, `studyMode`, `dictionaryApi`, `cardSchema`, `studySetSchema` and `authSchema`, under unchanged names, e.g. `Card`, `StudyConfig`, `isAnswerCorrect`, `eligibleCards`, `buildQuestion`, `exclusionReason`, `studyModeLabel`, `fetchEnglishDefinition`, `cardSchema`, `studySetSchema`, `authSchema`, `AuthFormValues`, `StudySetFormValues`.
  - **New:** `queryKeys`:
    ```ts
    queryKeys.studySets(): readonly ['study-sets']
    queryKeys.studySet(id: string): readonly ['study-set', string]
    queryKeys.cards(studySetId: string): readonly ['cards', string]
    queryKeys.cardImagePaths(studySetId: string): readonly ['card-image-paths', string]
    queryKeys.signedImageUrls(sortedPathsKey: string): readonly ['signed-image-urls', string]
    ```
    The key values are identical to today's, so cached data and invalidation behave exactly as before.

- [ ] **Step 1: Create the core package files**

`packages/core/package.json`:

```json
{
  "name": "@escritorio/core",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit -p .",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@types/node": "^24.13.3",
    "typescript": "~6.0.2",
    "vitest": "^5.0.0"
  }
}
```

`packages/core/tsconfig.json`. There's no `DOM` in `lib`. `@types/node` supplies the global `fetch` and `Response` types that `dictionaryApi.ts` needs, matching what React Native provides at runtime.

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["node"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "skipLibCheck": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Write the failing `queryKeys` test**

`packages/core/src/queryKeys.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { queryKeys } from './queryKeys'

// These values are what the web app already stores in its query cache.
// Changing one silently breaks invalidation, so they're pinned exactly.
describe('queryKeys', () => {
  it('matches the keys the web app has always used', () => {
    expect(queryKeys.studySets()).toEqual(['study-sets'])
    expect(queryKeys.studySet('s1')).toEqual(['study-set', 's1'])
    expect(queryKeys.cards('s1')).toEqual(['cards', 's1'])
    expect(queryKeys.cardImagePaths('s1')).toEqual(['card-image-paths', 's1'])
    expect(queryKeys.signedImageUrls('a.png,b.png')).toEqual(['signed-image-urls', 'a.png,b.png'])
  })

  it('nests per-set keys under distinct prefixes so invalidating one never hits another', () => {
    expect(queryKeys.studySet('s1')[0]).not.toBe(queryKeys.studySets()[0])
    expect(queryKeys.cards('s1')[0]).not.toBe(queryKeys.cardImagePaths('s1')[0])
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

```bash
bun install
cd packages/core && bunx vitest run src/queryKeys.test.ts; cd -
```

Expected: FAIL, "Failed to resolve import './queryKeys'".

- [ ] **Step 4: Implement `queryKeys.ts`**

`packages/core/src/queryKeys.ts`:

```ts
/**
 * TanStack Query keys shared by the web and mobile apps, so both
 * invalidate and persist the same cache entries. Values are pinned by
 * queryKeys.test.ts -- changing one orphans existing cached data.
 */
export const queryKeys = {
  studySets: () => ['study-sets'] as const,
  studySet: (id: string) => ['study-set', id] as const,
  cards: (studySetId: string) => ['cards', studySetId] as const,
  cardImagePaths: (studySetId: string) => ['card-image-paths', studySetId] as const,
  signedImageUrls: (sortedPathsKey: string) => ['signed-image-urls', sortedPathsKey] as const,
}
```

Run: `cd packages/core && bunx vitest run src/queryKeys.test.ts; cd -`
Expected: PASS (2 tests).

- [ ] **Step 5: Move the pure modules with history**

```bash
mkdir -p packages/core/src/schemas
git mv apps/web/src/types packages/core/src/types
git mv apps/web/src/lib/grading.ts apps/web/src/lib/grading.test.ts packages/core/src/
git mv apps/web/src/features/study/studyMode.ts apps/web/src/features/study/studyMode.test.ts packages/core/src/
git mv apps/web/src/features/study-sets/dictionaryApi.ts apps/web/src/features/study-sets/dictionaryApi.test.ts packages/core/src/
git mv apps/web/src/features/study-sets/cardSchema.ts apps/web/src/features/study-sets/studySetSchema.ts apps/web/src/features/auth/authSchema.ts packages/core/src/schemas/
```

Then fix the only `@/` imports inside the moved files. In `packages/core/src/studyMode.ts` and `packages/core/src/studyMode.test.ts`:

```ts
// before
import type { Card } from '@/types/card'
import type { ConversionDirection, MeaningVisibility, StudyMode } from '@/types/studySet'
// after
import type { Card } from './types/card'
import type { ConversionDirection, MeaningVisibility, StudyMode } from './types/studySet'
```

(`studyMode.test.ts` only has the `Card` import.)

- [ ] **Step 6: Write the barrel, and a test that pins its surface**

`packages/core/src/index.ts`:

```ts
export * from './types/card'
export * from './types/quizAttempt'
export * from './types/studySession'
export * from './types/studySet'
export * from './grading'
export * from './studyMode'
export * from './dictionaryApi'
export * from './queryKeys'
export * from './schemas/cardSchema'
export * from './schemas/studySetSchema'
export * from './schemas/authSchema'
```

`packages/core/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import * as core from './index'

// The web app (and later the mobile app) imports only from the barrel.
// If a re-export goes missing, this fails here rather than as a
// confusing build error in an app.
describe('@escritorio/core barrel', () => {
  it.each([
    'isAnswerCorrect',
    'normalizeAnswer',
    'isCardEligible',
    'eligibleCards',
    'buildQuestion',
    'exclusionReason',
    'studyModeLabel',
    'fetchEnglishDefinition',
    'fetchSpanishDefinition',
    'queryKeys',
    'cardSchema',
    'studySetSchema',
    'authSchema',
  ])('exports %s', (name) => {
    expect(core).toHaveProperty(name)
  })
})
```

Run: `cd packages/core && bunx vitest run; cd -`
Expected: PASS. All moved tests (grading, studyMode, dictionaryApi) plus `queryKeys` and the barrel test run in core.

- [ ] **Step 7: Point the web app at core**

Add the dependency in `apps/web/package.json` (`"dependencies"`) and make its test script tolerate having no test files:

```json
"@escritorio/core": "workspace:*",
```

```json
"test": "vitest run --passWithNoTests",
```

Run `bun install`. Then rewrite the imports. Every one of these import paths now resolves to the barrel:

```bash
cd apps/web
grep -rlE "from '(@/types/[a-zA-Z]+|@/lib/grading|@/features/study/studyMode|\./studyMode|\./cardSchema|\./studySetSchema|\./authSchema|\./dictionaryApi)'" src \
  | xargs sed -i '' -E "s#from '(@/types/[a-zA-Z]+|@/lib/grading|@/features/study/studyMode|\./studyMode|\./cardSchema|\./studySetSchema|\./authSchema|\./dictionaryApi)'#from '@escritorio/core'#"
cd -
```

A file that imported two of these modules now has two `from '@escritorio/core'` lines. Merge each pair into one import, keeping `import type` separate when the original was type-only. `verbatimModuleSyntax` requires that. Find the duplicates with:

```bash
grep -rc "from '@escritorio/core'" apps/web/src | grep -v ':0$' | grep -v ':1$'
```

- [ ] **Step 8: Replace the query-key helpers with `queryKeys`**

First delete the old helper definitions:

- In `apps/web/src/features/study-sets/hooks/useStudySets.ts`, delete the `export function studySetsKey()` and `export function studySetKey(id: string)` blocks (lines 15–21).
- In `apps/web/src/features/study-sets/hooks/useCards.ts`, delete the `export function cardsKey(studySetId: string)` block (lines 6–8).

Add `queryKeys` to each file's `@escritorio/core` import, or add `import { queryKeys } from '@escritorio/core'`. Then rewrite the call sites:

```bash
cd apps/web/src/features/study-sets/hooks
sed -i '' -E 's/studySetsKey\(\)/queryKeys.studySets()/g; s/studySetKey\(/queryKeys.studySet(/g' useStudySets.ts
sed -i '' -E 's/cardsKey\(/queryKeys.cards(/g' useCards.ts
cd -
```

In `useSignedImageUrls.ts`: `queryKey: ['signed-image-urls', sortedKey]` → `queryKey: queryKeys.signedImageUrls(sortedKey)`.
In `useStudySetFallbackImagePaths.ts`: `queryKey: ['card-image-paths', studySetId]` → `queryKey: queryKeys.cardImagePaths(studySetId)`.
Add the `queryKeys` import to both.

Confirm nothing still references the old helpers or old paths:

```bash
grep -rnE "studySetsKey|studySetKey|cardsKey|'signed-image-urls'|'card-image-paths'|@/types/|@/lib/grading|studyMode'|Schema'|dictionaryApi'" apps/web/src
```

Expected: no output.

- [ ] **Step 9: Verify core stays DOM-free, and everything builds**

Run: `cd packages/core && bunx tsc --noEmit -p .; cd -`
Expected: exits 0. If `fetch`, `Response` or `RequestInit` are unresolved, `@types/node` isn't installed in the workspace. Re-run `bun install`. **Do not add `DOM` to `lib`.**

Run: `bun run build`
Expected: both workspaces typecheck, and the Vite build succeeds.

Run: `bun run test`
Expected: core reports the baseline test count + 15 (2 `queryKeys` + 13 barrel), and web reports no test files without failing.

Run: `bun run lint && bun run format:check`
Expected: both pass. If `format:check` fails on the merged imports, run `bun run format` and re-check.

- [ ] **Step 10: Smoke-test the app**

Run `bun run dev`, sign in, open a set, change the study mode, and run a few cards of a study session. Check that grading, the mode picker and the definition lookup on a card all behave as before. Stop the server.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "refactor: extract pure domain code into @escritorio/core

Moves types, grading, study modes, schemas, dictionary API and
shared query keys into packages/core; the web app imports them from
the barrel. API modules stay in apps/web until client injection.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: CI, failure propagation and docs

**Files:**

- Modify: `.github/workflows/deploy.yml`, `README.md`

**Interfaces:**

- Consumes: root scripts from Task 1 (`lint`, `test`, `build`).
- Produces: a Pages deploy that builds from the workspace layout.

- [ ] **Step 1: Update the deploy workflow**

In `.github/workflows/deploy.yml`, only the artifact path changes. The root scripts keep their names.

```yaml
- uses: actions/upload-pages-artifact@v3
  with:
    path: apps/web/dist
```

Leave the `bun run build` step's `env:` block as-is. Vite reads `VITE_*` values from `process.env` as well as `.env` files, and environment variables pass through `bun run --filter`.

- [ ] **Step 2: Update the README**

Replace the Local development and Scripts sections of `README.md` with:

```markdown
## Repo layout

- `apps/web` — the Vite web app (deployed to GitHub Pages)
- `packages/core` — `@escritorio/core`: types, grading, study modes,
  schemas, dictionary API and query keys shared by every app
- `supabase/migrations` — database schema

## Local development

1. Copy `apps/web/.env.local.example` to `apps/web/.env.local` and fill
   in your Supabase project's URL and anon key.
2. `bun install`
3. `bun run dev`

## Scripts (run from the repo root)

- `bun run dev` — start the web dev server
- `bun run build` — typecheck every workspace and build the web app
- `bun run typecheck` — typecheck every workspace
- `bun run test` — run every workspace's tests (Vitest)
- `bun run lint` — lint with oxlint
- `bun run format` — format with Prettier
```

- [ ] **Step 3: Prove that failures propagate (Review Focus #2)**

Temporarily break a core test. In `packages/core/src/grading.test.ts`, change any `toBe(true)` expectation to `toBe(false)`.

Run: `bun run test; echo "exit=$?"`
Expected: the failure is reported, and `exit=` is **non-zero**.

Temporarily add `const unused = 1` to `packages/core/src/grading.ts`.

Run: `bun run build; echo "exit=$?"`
Expected: a `noUnusedLocals` error, and `exit=` is **non-zero**.

If either exits 0, `bun run --filter` isn't propagating failures in this Bun version. Replace the affected root script with explicit chained commands, then re-run both checks:

```json
"test": "bun run --cwd packages/core test && bun run --cwd apps/web test",
"typecheck": "bun run --cwd packages/core typecheck && bun run --cwd apps/web typecheck",
"build": "bun run typecheck && bun run --cwd apps/web build"
```

Revert both temporary edits with `git checkout packages/core/src/grading.test.ts packages/core/src/grading.ts`.

- [ ] **Step 4: Prove a fresh-clone install works (Review Focus #3)**

```bash
rm -rf node_modules apps/web/node_modules packages/core/node_modules
bun install --frozen-lockfile
```

Expected: succeeds with no "lockfile had changes" error. If it fails, run `bun install`, commit the updated `bun.lock`, and repeat.

- [ ] **Step 5: Run the CI sequence locally with CI-style env (Review Focus #4)**

```bash
mv apps/web/.env.local /tmp/escritorio.env.local.bak 2>/dev/null
bun run lint && bun run test && \
  VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=test bun run build && \
  ls apps/web/dist/index.html && grep -q 'example.supabase.co' -r apps/web/dist/assets && echo "env baked in"
mv /tmp/escritorio.env.local.bak apps/web/.env.local 2>/dev/null
```

Expected: prints `apps/web/dist/index.html` and `env baked in`. Then run `bun run build` again with your real `.env.local` restored.

- [ ] **Step 6: Commit and open the PR**

```bash
git add -A
git commit -m "ci: build Pages from apps/web; document workspace layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin HEAD
gh pr create --base develop --title "Monorepo restructure: apps/web + @escritorio/core (DR-10)" --body "$(cat <<'EOF'
Implements rollout step 1 of docs/superpowers/specs/2026-10-13-ios-app-design.md (Linear DR-10).

- Web app moved to `apps/web` with `git mv` (history preserved)
- Pure domain code extracted to `packages/core` (`@escritorio/core`): types, grading, study modes, schemas, dictionary API, shared query keys
- `src/api/*` intentionally stays in the web app until DR-11 (client injection)
- Pages deploy now uploads `apps/web/dist`

No behaviour change. Local setup: move `.env.local` to `apps/web/.env.local`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

After merge, confirm the Pages deploy run on `develop` succeeds and the live site loads and signs in.
