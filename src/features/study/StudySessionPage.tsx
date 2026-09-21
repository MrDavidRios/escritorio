import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useCards } from '@/features/study-sets/hooks/useCards'
import { useSignedImageUrls } from '@/features/study-sets/hooks/useSignedImageUrls'
import { useStudySet } from '@/features/study-sets/hooks/useStudySets'
import { useImagePrefetch } from '@/hooks/useImagePrefetch'
import { eligibleCards, buildQuestion, type Question, type StudyConfig } from './studyMode'
import { useCompleteStudySession, useStartStudySession } from './hooks/useStudySessions'
import { QuizCard } from './QuizCard'
import type { StudySet } from '@/types/studySet'

function configFromStudySet(studySet: StudySet): StudyConfig {
  return studySet.study_mode === 'conversion'
    ? { mode: 'conversion', direction: studySet.conversion_direction }
    : { mode: 'meaning', visibility: studySet.meaning_visibility }
}

export function StudySessionPage() {
  const { setId } = useParams<{ setId: string }>()
  const { data: studySet } = useStudySet(setId)
  const { data: cards, isLoading, isError, error } = useCards(setId)
  const [index, setIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)

  // Built once per (cards, config) pair, not recomputed on every
  // render -- under conversion mode's 'random' direction, recomputing
  // would reshuffle a card's direction mid-session.
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const builtForRef = useRef<string | null>(null)

  const startSession = useStartStudySession()
  const completeSession = useCompleteStudySession()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const sessionStartedRef = useRef(false)

  useEffect(() => {
    if (!cards || !studySet) return
    const config = configFromStudySet(studySet)
    const buildKey = `${studySet.id}:${studySet.study_mode}:${studySet.conversion_direction}:${studySet.meaning_visibility}:${cards.length}`
    if (builtForRef.current === buildKey) return
    builtForRef.current = buildKey

    const deck = eligibleCards(cards, config)
    setQuestions(deck.map((card) => buildQuestion(card, config)))
    setIndex(0)
    setCorrectCount(0)

    if (!sessionStartedRef.current && deck.length > 0) {
      sessionStartedRef.current = true
      startSession.mutate(
        {
          study_set_id: studySet.id,
          mode: config.mode,
          direction: config.mode === 'conversion' ? config.direction : null,
          visibility: config.mode === 'meaning' ? config.visibility : null,
          deck_size: deck.length,
        },
        { onSuccess: (session) => setSessionId(session.id) },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildKey captures every dependency that should retrigger this
  }, [cards, studySet])

  const imagePaths = useMemo(
    () => (questions ?? []).map((q) => q.card.image_path).filter((p): p is string => p != null),
    [questions],
  )
  const { data: imageUrls } = useSignedImageUrls(imagePaths)

  // Warm the browser's cache for every card in the deck as soon as their
  // signed URLs resolve, so advancing through the quiz doesn't wait on
  // each image's own fetch.
  useImagePrefetch(useMemo(() => Object.values(imageUrls ?? {}), [imageUrls]))

  const currentQuestion = questions?.[index]
  const isComplete = !!questions && questions.length > 0 && index >= questions.length

  useEffect(() => {
    if (isComplete && sessionId) {
      completeSession.mutate({ id: sessionId, cardsAnswered: correctCount })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when isComplete flips true
  }, [isComplete])

  if (!setId) {
    return <Navigate to="/" replace />
  }

  function restart() {
    if (!cards || !studySet) return
    const config = configFromStudySet(studySet)
    const deck = eligibleCards(cards, config)
    setQuestions(deck.map((card) => buildQuestion(card, config)))
    setIndex(0)
    setCorrectCount(0)
    sessionStartedRef.current = true
    setSessionId(null)
    startSession.mutate(
      {
        study_set_id: studySet.id,
        mode: config.mode,
        direction: config.mode === 'conversion' ? config.direction : null,
        visibility: config.mode === 'meaning' ? config.visibility : null,
        deck_size: deck.length,
      },
      { onSuccess: (session) => setSessionId(session.id) },
    )
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-4">
      <Link to="/" className="text-muted-foreground text-sm underline underline-offset-4">
        ← Back to study sets
      </Link>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {isError && (
        <p className="text-destructive text-sm">Failed to load cards: {(error as Error).message}</p>
      )}

      {questions && questions.length === 0 && (
        <p className="text-muted-foreground">
          No cards are eligible for this set's current study mode.{' '}
          <Link to={`/sets/${setId}`} className="underline underline-offset-4">
            Change the mode or add cards
          </Link>
          .
        </p>
      )}

      {currentQuestion && (
        <>
          <p className="text-muted-foreground text-sm">
            Card {index + 1} of {questions!.length}
          </p>
          <QuizCard
            key={currentQuestion.card.id}
            question={currentQuestion}
            imageUrl={
              currentQuestion.card.image_path
                ? imageUrls?.[currentQuestion.card.image_path]
                : undefined
            }
            sessionId={sessionId}
            onCorrect={() => setCorrectCount((c) => c + 1)}
            onNext={() => setIndex((i) => i + 1)}
          />
        </>
      )}

      {isComplete && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <h1 className="text-xl font-semibold">Nice work!</h1>
          <p className="text-muted-foreground">
            You've gone through all {questions!.length} cards in "{studySet?.title}".
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={restart}>
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
