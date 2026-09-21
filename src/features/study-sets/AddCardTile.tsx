import { Loader2, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CardTile } from './CardTile'
import { cardSchema } from './cardSchema'
import { useCreateCard } from './hooks/useCards'

export function AddCardTile({
  studySetId,
  ownerId,
  empty,
}: {
  studySetId: string
  ownerId: string
  empty?: boolean
}) {
  const [image, setImage] = useState<File | null>(null)
  const [manualEntry, setManualEntry] = useState(false)
  const [spanishTerm, setSpanishTerm] = useState('')
  const [englishEquivalent, setEnglishEquivalent] = useState('')
  const [definition, setDefinition] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState<string | null>(null)

  const createCard = useCreateCard(studySetId, ownerId)
  const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function reset() {
    setImage(null)
    setManualEntry(false)
    setSpanishTerm('')
    setEnglishEquivalent('')
    setDefinition('')
    setHint('')
    setError(null)
  }

  function pickUpFile(file: File | null | undefined) {
    if (!file) return
    setImage(file)
    setError(null)
  }

  async function submit() {
    const parsed = cardSchema.safeParse({
      spanish_term: spanishTerm,
      hint,
      english_equivalent: englishEquivalent,
      definition,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    if (!image && !parsed.data.definition) {
      setError('Add an image or a definition')
      return
    }
    setError(null)
    try {
      await createCard.mutateAsync({
        image,
        hint: parsed.data.hint,
        spanish_term: parsed.data.spanish_term,
        english_equivalent: parsed.data.english_equivalent,
        definition: parsed.data.definition,
      })
      reset()
    } catch {
      setError("Couldn't add card")
    }
  }

  if (!image && !manualEntry) {
    return (
      <button
        type="button"
        onClick={() => setManualEntry(true)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) {
            pickUpFile(file)
            setManualEntry(true)
          }
        }}
        onPaste={(e) => {
          const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
          const file = item?.getAsFile()
          if (file) {
            pickUpFile(file)
            setManualEntry(true)
          }
        }}
        className={cn(
          'border-input hover:bg-muted/40 focus-visible:bg-muted/40 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors duration-150',
          empty ? 'col-span-full aspect-auto py-12' : 'aspect-[4/3]',
        )}
      >
        <Plus className="text-muted-foreground size-6" />
        <span className="text-sm font-medium">{empty ? 'Add your first card' : 'Add card'}</span>
        {empty && (
          <span className="text-muted-foreground max-w-sm text-xs">
            Type the answer you want to recall, with an optional image.
          </span>
        )}
      </button>
    )
  }

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
}
