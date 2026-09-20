import { ImageIcon, Trash2, X } from 'lucide-react'
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

  const canRemoveImage = Boolean(card.image_path && card.definition)

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
        {canRemoveImage && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove image"
            onClick={(e) => {
              e.stopPropagation()
              removeImage()
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
          value={card.spanish_term}
          onSave={(spanish_term) => save({ spanish_term })}
          placeholder="Spanish term"
          label="Card spanish term"
          required
          className="font-medium"
          accessory={(insert) => <AccentedCharPad onInsert={insert} />}
        />
        <InlineText
          value={card.english_equivalent ?? ''}
          onSave={(english_equivalent) => save({ english_equivalent })}
          placeholder="Add an English equivalent"
          label="Card English equivalent"
          className="text-muted-foreground text-sm"
        />
        <InlineText
          value={card.definition ?? ''}
          onSave={(definition) => save({ definition })}
          placeholder="Add a definition"
          label="Card definition"
          multiline
          className="text-muted-foreground text-sm"
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
