import { ImageIcon, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthContext'
import { CardFormDialog } from './CardFormDialog'
import { DeleteCardDialog } from './DeleteCardDialog'
import { useCards } from './hooks/useCards'
import { useSignedImageUrls } from './hooks/useSignedImageUrls'

export function CardsSection({ studySetId }: { studySetId: string }) {
  const { user } = useAuth()
  const { data: cards, isLoading, isError, error } = useCards(studySetId)
  const imagePaths = cards?.map((card) => card.image_path) ?? []
  const { data: imageUrls } = useSignedImageUrls(imagePaths)

  if (!user) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cards</h2>
        <CardFormDialog
          studySetId={studySetId}
          ownerId={user.id}
          trigger={
            <Button size="sm">
              <Plus data-icon="inline-start" />
              Add card
            </Button>
          }
        />
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {isError && (
        <p className="text-destructive text-sm">Failed to load cards: {(error as Error).message}</p>
      )}

      {cards && cards.length === 0 && (
        <p className="text-muted-foreground">No cards yet. Add one to start building this set.</p>
      )}

      <div className="flex flex-col gap-2">
        {cards?.map((card) => {
          const imageUrl = imageUrls?.[card.image_path]
          return (
            <div key={card.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="bg-muted/50 flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                ) : (
                  <ImageIcon className="text-muted-foreground size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{card.answer}</p>
                {card.hint && (
                  <p className="text-muted-foreground truncate text-sm">Hint: {card.hint}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <CardFormDialog
                  studySetId={studySetId}
                  ownerId={user.id}
                  card={card}
                  existingImageUrl={imageUrl}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Pencil data-icon="inline-start" />
                      Edit
                    </Button>
                  }
                />
                <DeleteCardDialog studySetId={studySetId} card={card} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
