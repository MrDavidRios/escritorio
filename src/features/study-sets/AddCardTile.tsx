import { Loader2, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { AccentedCharPad } from '@/components/AccentedCharPad'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCursorInsert } from '@/hooks/useCursorInsert'
import { cn } from '@/lib/utils'
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
  const [answer, setAnswer] = useState('')
  const [hint, setHint] = useState('')
  const [error, setError] = useState<string | null>(null)
  const answerRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createCard = useCreateCard(studySetId, ownerId)
  const previewUrl = useMemo(() => (image ? URL.createObjectURL(image) : null), [image])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (image) answerRef.current?.focus()
  }, [image])

  const answerCursor = useCursorInsert(
    () => answer,
    (next) => setAnswer(next),
  )

  function reset() {
    setImage(null)
    setAnswer('')
    setHint('')
    setError(null)
  }

  function pickUpFile(file: File | null | undefined) {
    if (!file) return
    setImage(file)
    setError(null)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    pickUpFile(e.dataTransfer.files[0])
  }

  async function submit() {
    if (!image) return
    if (!answer.trim()) {
      setError('Answer is required')
      return
    }
    setError(null)
    try {
      await createCard.mutateAsync({ image, hint, answer: answer.trim() })
      reset()
    } catch {
      setError("Couldn't add card")
    }
  }

  if (!image) {
    return (
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onPaste={(e) => {
          const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
          const file = item?.getAsFile()
          if (file) pickUpFile(file)
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
            Drop or paste an image, then type the answer you want to recall.
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickUpFile(e.target.files?.[0])}
        />
      </button>
    )
  }

  return (
    <div className="ring-foreground/10 flex flex-col overflow-hidden rounded-xl ring-1">
      <div className="bg-muted/50 relative aspect-[4/3] w-full">
        <img src={previewUrl!} alt="" className="size-full object-cover" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white opacity-0 transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100"
        >
          Change
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickUpFile(e.target.files?.[0])}
        />
      </div>

      <div className="flex flex-col gap-2 p-3">
        <AccentedCharPad onInsert={answerCursor.insert} />
        <Input
          ref={(el) => {
            answerRef.current = el
            answerCursor.setRef(el)
          }}
          aria-label="Answer"
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') reset()
          }}
        />
        <Input
          aria-label="Hint"
          placeholder="Add a hint"
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') reset()
          }}
        />
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
    </div>
  )
}
