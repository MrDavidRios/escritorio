import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Card } from '@/types/card'
import { CardTile } from './CardTile'
import { hasRequiredContent } from './cardSchema'
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
  // What the card has toward cards_content_required; each guard below asks
  // whether the card would still satisfy it with one piece removed.
  const content = {
    hasImage: Boolean(card.image_path),
    definition: card.definition,
    englishEquivalent: card.english_equivalent,
  }

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
      removeImageDisabledReason={
        hasRequiredContent({ ...content, hasImage: false })
          ? undefined
          : 'Add a definition or English equivalent before removing the image'
      }
      spanishTerm={card.spanish_term}
      onSaveSpanishTerm={(spanish_term) => save({ spanish_term })}
      englishEquivalent={card.english_equivalent ?? ''}
      onSaveEnglishEquivalent={(english_equivalent) => save({ english_equivalent })}
      englishEquivalentRequired={!hasRequiredContent({ ...content, englishEquivalent: null })}
      definition={card.definition ?? ''}
      onSaveDefinition={(definition) => save({ definition })}
      definitionRequired={!hasRequiredContent({ ...content, definition: null })}
      hint={card.hint ?? ''}
      onSaveHint={(hint) => save({ hint })}
      collapseEmptyFields
      actions={
        <Tooltip>
          <DeleteCardDialog
            studySetId={studySetId}
            card={card}
            trigger={
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete card"
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </TooltipTrigger>
            }
          />
          <TooltipContent side="right">Delete card</TooltipContent>
        </Tooltip>
      }
    />
  )
}
