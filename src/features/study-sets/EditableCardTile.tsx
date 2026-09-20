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
