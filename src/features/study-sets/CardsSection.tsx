import type { StudyConfig } from '@/features/study/studyMode'
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

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">
        Cards <span className="text-muted-foreground font-normal">{cardCount}</span>
      </h2>

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
          {cards.map((card) => (
            <EditableCardTile
              key={card.id}
              studySetId={studySetId}
              ownerId={ownerId}
              card={card}
              config={config}
              imageUrl={card.image_path ? imageUrls?.[card.image_path] : undefined}
              onSaving={onSaving}
              onSaved={onSaved}
              onError={onError}
            />
          ))}
          <AddCardTile studySetId={studySetId} ownerId={ownerId} empty={cardCount === 0} />
        </div>
      )}
    </div>
  )
}
