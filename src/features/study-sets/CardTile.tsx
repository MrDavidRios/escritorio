import { ImageIcon, Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { AccentedCharPad } from '@/components/AccentedCharPad'
import { InlineText } from '@/components/InlineText'
import { Button } from '@/components/ui/button'
import type { Card } from '@/types/card'
import { DeleteCardDialog } from './DeleteCardDialog'
import { useUpdateCard } from './hooks/useCards'

export function CardTile({
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  function save(patch: { hint: string } | { answer: string }) {
    const variables = {
      card,
      image: null,
      hint: 'hint' in patch ? patch.hint : (card.hint ?? ''),
      answer: 'answer' in patch ? patch.answer : card.answer,
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
      { card, image: file, hint: card.hint ?? '', answer: card.answer },
      {
        onSuccess: onSaved,
        onError: () => onError(() => replaceImage(file)),
      },
    )
  }

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
          <div className="flex size-full items-center justify-center">
            <ImageIcon className="text-muted-foreground size-6" />
          </div>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white opacity-0 transition-opacity duration-150 group-focus-within/image:opacity-100 group-hover/image:opacity-100 [@media(hover:none)]:bg-black/30 [@media(hover:none)]:opacity-100"
        >
          Change
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) replaceImage(file)
          }}
        />
      </div>

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

      <div className="flex flex-col gap-0.5 p-3">
        <InlineText
          value={card.answer}
          onSave={(answer) => save({ answer })}
          placeholder="Answer"
          label="Card answer"
          required
          className="font-medium"
          accessory={(insert) => <AccentedCharPad onInsert={insert} />}
        />
        <InlineText
          value={card.hint ?? ''}
          onSave={(hint) => save({ hint })}
          placeholder="Add a hint"
          label="Card hint"
          className="text-muted-foreground text-sm"
        />
      </div>
    </div>
  )
}
