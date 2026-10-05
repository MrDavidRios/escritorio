import { exclusionReason, type StudyConfig } from '@/features/study/studyMode'
import { AddCardTile } from './AddCardTile'
import { EditableCardTile } from './EditableCardTile'
import { useCards } from './hooks/useCards'
import { useSignedImageUrls } from './hooks/useSignedImageUrls'

export function CardsSection({
  studySetId,
  ownerId,
  config,
  onSaving,
  onSaved,
  onError,
}: {
  studySetId: string
  ownerId: string
  config: StudyConfig
  onSaving: () => void
  onSaved: () => void
  onError: (retry: () => void) => void
}) {
  const { data: cards, isLoading, isError } = useCards(studySetId)
  const imagePaths = (cards ?? []).map((card) => card.image_path).filter((p): p is string => p != null)
  const { data: imageUrls } = useSignedImageUrls(imagePaths)

  const cardCount = cards?.length ?? 0
  const eligibleCards = (cards ?? []).filter((card) => !exclusionReason(card, config))
  const excludedCards = (cards ?? []).filter((card) => exclusionReason(card, config))

  function renderTile(card: NonNullable<typeof cards>[number]) {
    return (
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
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-muted aspect-4/3 w-full animate-pulse rounded-xl" />
          ))}
        </div>
      )}

      {isError && <p className="text-destructive text-sm">Couldn't load this set's cards.</p>}

      {cards && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {eligibleCards.map(renderTile)}
          <AddCardTile studySetId={studySetId} ownerId={ownerId} empty={cardCount === 0} />
        </div>
      )}

      {excludedCards.length > 0 && (
        <section className="mt-4 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              Not in this study mode{' '}
              <span className="text-muted-foreground font-normal">{excludedCards.length}</span>
            </h2>
            <p className="text-muted-foreground text-sm">
              These cards are missing something this study mode needs.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {excludedCards.map(renderTile)}
          </div>
        </section>
      )}
    </div>
  )
}
