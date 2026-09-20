import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useCards } from '@/features/study-sets/hooks/useCards'
import { useSignedImageUrls } from '@/features/study-sets/hooks/useSignedImageUrls'
import { useStudySet } from '@/features/study-sets/hooks/useStudySets'
import { useImagePrefetch } from '@/hooks/useImagePrefetch'
import { QuizCard } from './QuizCard'

export function StudySessionPage() {
  const { setId } = useParams<{ setId: string }>()
  const { data: studySet } = useStudySet(setId)
  const { data: cards, isLoading, isError, error } = useCards(setId)
  const [index, setIndex] = useState(0)

  const imagePaths = useMemo(() => cards?.map((card) => card.image_path) ?? [], [cards])
  const { data: imageUrls } = useSignedImageUrls(imagePaths)

  // Warm the browser's cache for every card in the deck as soon as their
  // signed URLs resolve, so advancing through the quiz doesn't wait on
  // each image's own fetch.
  useImagePrefetch(useMemo(() => Object.values(imageUrls ?? {}), [imageUrls]))

  if (!setId) {
    return <Navigate to="/" replace />
  }

  const currentCard = cards?.[index]
  const isComplete = !!cards && cards.length > 0 && index >= cards.length

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-4">
      <Link to="/" className="text-muted-foreground text-sm underline underline-offset-4">
        ← Back to study sets
      </Link>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {isError && (
        <p className="text-destructive text-sm">Failed to load cards: {(error as Error).message}</p>
      )}

      {cards && cards.length === 0 && (
        <p className="text-muted-foreground">
          This set has no cards yet.{' '}
          <Link to={`/sets/${setId}`} className="underline underline-offset-4">
            Add some
          </Link>
          .
        </p>
      )}

      {currentCard && (
        <>
          <p className="text-muted-foreground text-sm">
            Card {index + 1} of {cards!.length}
          </p>
          <QuizCard
            key={currentCard.id}
            card={currentCard}
            imageUrl={imageUrls?.[currentCard.image_path]}
            onNext={() => setIndex((i) => i + 1)}
          />
        </>
      )}

      {isComplete && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <h1 className="text-xl font-semibold">Nice work!</h1>
          <p className="text-muted-foreground">
            You've gone through all {cards!.length} cards in "{studySet?.title}".
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIndex(0)}>
              Study again
            </Button>
            <Button asChild>
              <Link to={`/sets/${setId}`}>Back to the set</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
