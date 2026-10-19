# Reuse Card Element for First-Time Card Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "manual entry" / image-attached state of `AddCardTile` (the first-time card creation form) render the exact same card element used for inline editing of an existing card, instead of its own hand-rolled `Input`/`Textarea` layout.

**Architecture:** `CardTile` becomes a dumb presentational component — values in, `onSave*` callbacks out, two slots (`cornerSlot`, `footer`) — with no data fetching or mutations inside it. Persistence moves up to two parents: a new thin container, `EditableCardTile`, wires it to `useUpdateCard` for existing cards (autosave per field on commit), and `AddCardTile` wires the same `CardTile` to local `useState` draft values, hitting `useCreateCard` only on final submit. A new `autoFocus` prop on `InlineText` replaces `AddCardTile`'s manual input-focus effect, since the Spanish term field is no longer a raw `<Input>` it can imperatively focus.

**Tech Stack:** React, TypeScript, Tailwind, `InlineText` (existing inline-edit primitive), `AccentedCharPad`, `useCursorInsert`, `useUpdateCard`/`useCreateCard` (React Query mutations).

**Spec:** No separate spec doc — the requirement is the screenshot and instruction in conversation: the new-card element should look identical to an existing inline-edited card (image box with centered "Add image" placeholder, Spanish term as plain text, then icon-prefixed `InlineText` rows for English equivalent / definition / hint).

## Global Constraints

- Do not change the visible appearance or behavior of existing cards — Task 2 is a pure move plus a props/slots indirection, not a redesign.
- Move JSX and Tailwind classes **verbatim**. `CardsSection.tsx` is mid-migration to Tailwind v4 bare fractions (`aspect-4/3`) while `CardTile.tsx` still uses `aspect-[4/3]`; keep `aspect-[4/3]` in the moved markup. Migrating it is a separate concern, not part of this plan.
- No new test infrastructure: this repo's `vitest` setup has no React Testing Library/jsdom (only `src/lib/grading.test.ts`, a plain logic test). Verification here is manual, via the dev server in a browser — do not write component tests that don't fit the existing setup.
- Keep `cardSchema` validation and the "image or definition required" rule in `AddCardTile.submit()` unchanged.
- Preserve the keyboard behavior already in `InlineText` (Escape reverts the field being edited, Enter/Cmd+Enter commits). Do not add a form-level Escape handler to reset the whole new-card form — the "Cancel" button covers that.

---

### Task 1: Add `autoFocus` to `InlineText`

**Files:**
- Modify: `src/components/InlineText.tsx:8-44`

**Interfaces:**
- Produces: `InlineText` gains an optional prop `autoFocus?: boolean` (default `false`). When `true`, the field starts in editing mode on mount; the existing "focus + place cursor at end" effect (currently lines 54-61) then fires on mount, since it already runs whenever `editing` is true.

- [ ] **Step 1: Add the prop and wire initial state**

In `src/components/InlineText.tsx`, add `autoFocus?: boolean` to `InlineTextProps`, after `icon`:

```tsx
  /** Rendered above the field while editing, wired to insert at the caret. */
  accessory?: (insert: (text: string) => void) => React.ReactNode
  /** Rendered before the value/placeholder. */
  icon?: React.ReactNode
  /** Start already in edit mode on mount. */
  autoFocus?: boolean
```

Destructure it in the function signature and use it as the initial `editing` state:

```tsx
export function InlineText({
  value,
  onSave,
  placeholder,
  label,
  multiline = false,
  required = false,
  as = 'span',
  className,
  accessory,
  icon,
  autoFocus = false,
}: InlineTextProps) {
  const [editing, setEditing] = useState(autoFocus)
```

- [ ] **Step 2: Manual check**

Run `npm run dev`, open a study set, and confirm existing inline-editable fields (the four fields on an existing card; the study set title) still render collapsed by default and behave exactly as before — `autoFocus` defaults to `false`, so nothing should change until Task 3 passes it.

- [ ] **Step 3: Commit**

```bash
git add src/components/InlineText.tsx
git commit -m "feat: add autoFocus prop to InlineText" --trailer "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Make `CardTile` dumb, move persistence into `EditableCardTile`

**Files:**
- Modify: `src/features/study-sets/CardTile.tsx` (rewrite as presentational)
- Create: `src/features/study-sets/EditableCardTile.tsx`
- Modify: `src/features/study-sets/CardsSection.tsx:43-54`

**Interfaces:**
- Consumes: `InlineText` with the `autoFocus` prop from Task 1.
- Produces: the dumb `CardTile` (props below), consumed by `EditableCardTile` here and by `AddCardTile` in Task 3; and `EditableCardTile`, which takes exactly the props `CardTile` takes today, so `CardsSection` only changes the component name it renders.

```ts
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
}
```

- [ ] **Step 1: Rewrite `CardTile.tsx` as a presentational component**

This is the current JSX body with `card.*` reads replaced by props and the three mutation callbacks replaced by `onSave*`/`onPickImage`/`onRemoveImage`. The hidden file input and the "Change"/"Add image" affordance move here as the single implementation (today `CardTile` has one copy and `AddCardTile` has two more, one per sub-state).

```tsx
import { BadgeQuestionMark, BookOpen, ImageIcon, Languages, X } from 'lucide-react'
import { useRef } from 'react'
import { AccentedCharPad } from '@/components/AccentedCharPad'
import { InlineText } from '@/components/InlineText'
import { Button } from '@/components/ui/button'

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
}

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
}: CardTileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="ring-foreground/10 group relative flex flex-col overflow-hidden rounded-xl ring-1">
      <div className="group/image bg-muted/50 relative aspect-[4/3] w-full">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1">
            <ImageIcon className="text-muted-foreground size-6" />
            <span className="text-muted-foreground text-xs">Add image</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white opacity-0 transition-opacity duration-150 group-focus-within/image:opacity-100 group-hover/image:opacity-100 [@media(hover:none)]:bg-black/30 [@media(hover:none)]:opacity-100"
        >
          Change
        </button>
        {canRemoveImage && onRemoveImage && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove image"
            onClick={(e) => {
              e.stopPropagation()
              onRemoveImage()
            }}
            className="absolute top-2 left-2 bg-black/40 text-white opacity-0 transition-opacity duration-150 hover:bg-black/60 hover:text-white group-focus-within/image:opacity-100 group-hover/image:opacity-100 [@media(hover:none)]:opacity-70"
          >
            <X />
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onPickImage(file)
          }}
        />
      </div>

      {cornerSlot}

      <div className="flex flex-col gap-0.5 p-3">
        <InlineText
          value={spanishTerm}
          onSave={onSaveSpanishTerm}
          placeholder="Spanish term"
          label="Card spanish term"
          required
          autoFocus={autoFocusSpanishTerm}
          className="font-medium"
          accessory={(insert) => <AccentedCharPad onInsert={insert} />}
        />
        <InlineText
          value={englishEquivalent}
          onSave={onSaveEnglishEquivalent}
          placeholder="Add an English equivalent"
          label="Card English equivalent"
          className="text-muted-foreground text-sm"
          icon={<Languages />}
        />
        <InlineText
          value={definition}
          onSave={onSaveDefinition}
          placeholder="Add a definition"
          label="Card definition"
          multiline
          className="text-muted-foreground text-sm"
          icon={<BookOpen />}
        />
        <InlineText
          value={hint}
          onSave={onSaveHint}
          placeholder="Add a hint"
          label="Card hint"
          className="text-muted-foreground text-sm"
          icon={<BadgeQuestionMark />}
        />
      </div>

      {footer}
    </div>
  )
}
```

`cornerSlot` sits right after the image box, which is where `EditableCardTile`'s delete button lives in the DOM today. It's positioned `absolute top-2 right-2` against the outer `group relative` wrapper, so only being a descendant of that wrapper matters.

- [ ] **Step 2: Create `EditableCardTile.tsx`**

This is the mutation wiring lifted out of the old `CardTile`, unchanged, now passing its results down as callbacks. Its props are identical to the old `CardTile`'s props.

```tsx
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Card } from '@/types/card'
import { CardTile } from './CardTile'
import { DeleteCardDialog } from './DeleteCardDialog'
import { useUpdateCard } from './hooks/useCards'

export function EditableCardTile({
  studySetId,
  ownerId,
  card,
  imageUrl,
  onSaving,
  onSaved,
  onError,
}: {
  studySetId: string
  ownerId: string
  card: Card
  imageUrl?: string
  onSaving: () => void
  onSaved: () => void
  onError: (retry: () => void) => void
}) {
  const updateCard = useUpdateCard(studySetId, ownerId)

  function save(
    patch:
      | { hint: string }
      | { spanish_term: string }
      | { english_equivalent: string }
      | { definition: string },
  ) {
    const variables = {
      card,
      image: null,
      hint: 'hint' in patch ? patch.hint : (card.hint ?? ''),
      spanish_term: 'spanish_term' in patch ? patch.spanish_term : card.spanish_term,
      english_equivalent:
        'english_equivalent' in patch ? patch.english_equivalent : (card.english_equivalent ?? ''),
      definition: 'definition' in patch ? patch.definition : (card.definition ?? ''),
    }
    onSaving()
    updateCard.mutate(variables, {
      onSuccess: onSaved,
      onError: () => onError(() => save(patch)),
    })
  }

  function replaceImage(file: File) {
    onSaving()
    updateCard.mutate(
      {
        card,
        image: file,
        hint: card.hint ?? '',
        spanish_term: card.spanish_term,
        english_equivalent: card.english_equivalent ?? '',
        definition: card.definition ?? '',
      },
      {
        onSuccess: onSaved,
        onError: () => onError(() => replaceImage(file)),
      },
    )
  }

  function removeImage() {
    onSaving()
    updateCard.mutate(
      {
        card,
        image: null,
        removeImage: true,
        hint: card.hint ?? '',
        spanish_term: card.spanish_term,
        english_equivalent: card.english_equivalent ?? '',
        definition: card.definition ?? '',
      },
      {
        onSuccess: onSaved,
        onError: () => onError(() => removeImage()),
      },
    )
  }

  return (
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
      cornerSlot={
        <DeleteCardDialog
          studySetId={studySetId}
          card={card}
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete card"
              className="text-destructive hover:bg-destructive/20 absolute top-2 right-2 bg-black/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-70"
            >
              <Trash2 />
            </Button>
          }
        />
      }
    />
  )
}
```

- [ ] **Step 3: Point `CardsSection` at `EditableCardTile`**

In `src/features/study-sets/CardsSection.tsx`, swap the import and the rendered component inside the `cards.map(...)`. Every prop stays the same:

```tsx
import { EditableCardTile } from './EditableCardTile'
```

```tsx
          {cards.map((card) => (
            <EditableCardTile
              key={card.id}
              studySetId={studySetId}
              ownerId={ownerId}
              card={card}
              imageUrl={card.image_path ? imageUrls?.[card.image_path] : undefined}
              onSaving={onSaving}
              onSaved={onSaved}
              onError={onError}
            />
          ))}
```

Remove the now-unused `import { CardTile } from './CardTile'`.

- [ ] **Step 4: Manual check**

Run `npm run dev` and open a study set with at least one existing card. Compared to before this task, confirm:
- The card tile looks pixel-identical (image box, hover "Change" overlay, remove-image X where applicable, delete-card trash icon top-right, all four fields with their icons).
- Each field still enters inline edit on click, autosaves on blur/Enter, reverts on Escape.
- Changing and removing the image still work, and the saving/saved/error indicators driven by `onSaving`/`onSaved`/`onError` still fire.
- Deleting a card still works.
- `npx tsc --noEmit` passes (catches any missed prop rename).

- [ ] **Step 5: Commit**

```bash
git add src/features/study-sets/CardTile.tsx src/features/study-sets/EditableCardTile.tsx src/features/study-sets/CardsSection.tsx
git commit -m "refactor: make CardTile presentational, move persistence to EditableCardTile" --trailer "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Render `CardTile` for `AddCardTile`'s expanded state

**Files:**
- Modify: `src/features/study-sets/AddCardTile.tsx`

**Interfaces:**
- Consumes: the dumb `CardTile` from Task 2.

- [ ] **Step 1: Replace the expanded-state JSX and drop the now-unused local wiring**

In `src/features/study-sets/AddCardTile.tsx`:

1. Delete `spanishTermRef`, the `spanishTermCursor` `useCursorInsert` call, and the `useEffect` that focuses `spanishTermRef` when `image`/`manualEntry` change — `CardTile`/`InlineText` now own focus (via `autoFocusSpanishTerm`) and caret insertion (via `InlineText`'s own `accessory` wiring).
2. Remove the imports that are no longer used: `Input`, `Textarea`, `useCursorInsert`, `AccentedCharPad`, and the field icons `BadgeQuestionMark`, `BookOpen`, `ImageIcon`, `Languages`. From `lucide-react` only `Loader2`, `Plus`, and `X` remain (collapsed dashed tile, submit spinner, cancel button); `cn` stays for the collapsed tile's className.
3. Add `import { CardTile } from './CardTile'`.
4. Replace the entire second `return` block (the expanded state, currently lines 153-262) with:

```tsx
  return (
    <CardTile
      imageUrl={previewUrl ?? undefined}
      onPickImage={pickUpFile}
      onRemoveImage={() => setImage(null)}
      canRemoveImage={Boolean(image)}
      spanishTerm={spanishTerm}
      onSaveSpanishTerm={setSpanishTerm}
      autoFocusSpanishTerm
      englishEquivalent={englishEquivalent}
      onSaveEnglishEquivalent={setEnglishEquivalent}
      definition={definition}
      onSaveDefinition={setDefinition}
      hint={hint}
      onSaveHint={setHint}
      footer={
        <div className="flex flex-col gap-2 p-3 pt-0">
          {error && <p className="text-destructive text-xs">{error}</p>}
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={submit} disabled={createCard.isPending}>
              {createCard.isPending && <Loader2 data-icon="inline-start" className="animate-spin" />}
              {createCard.isPending ? 'Adding…' : 'Add card'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              <X data-icon="inline-start" />
              Cancel
            </Button>
          </div>
        </div>
      }
    />
  )
```

`pickUpFile` currently takes `File | null | undefined`; `onPickImage` passes a non-null `File`, which is assignable, so its signature can stay as-is.

`submit`, `reset`, `pickUpFile`, `handleDrop`, the `previewUrl` memo and its revoke effect, and the collapsed (`!image && !manualEntry`) dashed-tile branch are all unchanged.

Note: this drops the per-field `Escape` → `reset()` behavior the raw inputs had. Escape now reverts just the field being edited, matching an existing card; "Cancel" resets the whole form. This is intentional per the Global Constraints.

- [ ] **Step 2: Manual check**

Run `npm run dev`, open a study set, and verify:
- "Add card" → "Add without an image": the expanded form is visually identical to an existing card tile (image placeholder box with centered icon + "Add image", no separate button row above the fields), and the Spanish term field opens already focused in edit mode — matching the old auto-focus behavior.
- Type a Spanish term, then click through English equivalent, definition, and hint: each behaves like an existing card's field (click to edit, commit on blur/Enter, Escape reverts that field).
- Click the image box → pick a file → the preview appears with the "Change" hover overlay and an X that clears it back to the placeholder.
- Drag-and-drop and paste an image onto the collapsed tile → still jumps straight to the expanded state with the preview.
- Submit with only an image and no definition → succeeds. Submit with neither → the "Add an image or a definition" error renders in the footer. Submit with an empty Spanish term → the `cardSchema` error renders.
- "Cancel" → back to the collapsed dashed tile, all fields cleared.
- A newly added card appears in the grid and is immediately inline-editable.
- The `AccentedCharPad` now floats next to the Spanish term field only while editing, rather than sitting as a permanent toolbar above it — same as an existing card.
- `npx tsc --noEmit` passes.

- [ ] **Step 3: Commit**

```bash
git add src/features/study-sets/AddCardTile.tsx
git commit -m "refactor: reuse CardTile for AddCardTile manual entry" --trailer "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** The single requirement — the first-time editing experience should look the same as an existing inline-edited card — is delivered by Task 2 (making `CardTile` the shared dumb element) and Task 3 (pointing `AddCardTile` at it). Task 1 is the small enabling change Task 3 needs for focus parity.
- **Behavior change flagged:** Escape inside a field no longer cancels the whole new-card form; it reverts that field. Called out in Task 3 rather than silently dropped. If it turns out to matter, a form-level Escape handler wrapping `CardTile` would restore it, but that's deliberately out of scope here.
- **Dedup:** Task 2 collapses three copies of the "pick/replace image via hidden file input" logic (one in `CardTile`, two across `AddCardTile`'s sub-states) into one.
- **Naming check:** `CardTile` is the dumb component everywhere after Task 2; `EditableCardTile` is the only thing that touches `useUpdateCard`. No file both renders card markup and runs a mutation.
