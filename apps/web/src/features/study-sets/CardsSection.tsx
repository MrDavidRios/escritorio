import { MasonryGrid } from '@/components/MasonryGrid'
import { exclusionReason, type StudyConfig } from '@/features/study/studyMode'
import { AddCardTile } from './AddCardTile'
import { EditableCardTile } from './EditableCardTile'
import { useCards } from './hooks/useCards'
import { useSignedImageUrls } from './hooks/useSignedImageUrls'

// Mixed heights so the placeholder already reads as the masonry it becomes.
const SKELETON_HEIGHTS = ['h-56', 'h-24', 'h-44', 'h-32', 'h-28', 'h-48', 'h-20', 'h-36']

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
  const imagePaths = (cards ?? [])
    .map((card) => card.image_path)
    .filter((p): p is string => p != null)
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
        <MasonryGrid>
          {SKELETON_HEIGHTS.map((height, i) => (
            <div key={i} className={`bg-muted w-full animate-pulse rounded-xl ${height}`} />
          ))}
        </MasonryGrid>
      )}

      {isError && <p className="text-destructive text-sm">Couldn't load this set's cards.</p>}

      {cards && cardCount === 0 && <AddCardTile studySetId={studySetId} ownerId={ownerId} empty />}

      {cards && cardCount > 0 && (
        <MasonryGrid>
          {eligibleCards.map(renderTile)}
          <AddCardTile studySetId={studySetId} ownerId={ownerId} />
        </MasonryGrid>
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
          <MasonryGrid>{excludedCards.map(renderTile)}</MasonryGrid>
        </section>
      )}
    </div>
  )
}
