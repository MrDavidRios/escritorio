import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { warmUpGrader } from '@/api/gradePhrase'
import { PhraseNotFoundError } from '@/api/phraseReviews'
import { DEFAULT_NEW_PHRASES_PER_DAY } from '@/api/userSettings'
import type { Resolution } from '@/components/typedAnswerState'
import { Button } from '@/components/ui/button'
import { useSignedImageUrls } from '@/features/study-sets/hooks/useSignedImageUrls'
import { useImagePrefetch } from '@/hooks/useImagePrefetch'
import { dueToday, practiceSet } from './dailyQueue'
import { relativeDayLabel, todayKey } from './dates'
import { ratingFor } from './grading'
import { PhraseQuizCard, type PhraseOutcome } from './PhraseQuizCard'
import { nextSchedule } from './scheduler'
import {
  afterResolved,
  buildSession,
  summarize,
  type SessionItem,
  type SessionMode,
  type SessionResult,
} from './sessionQueue'
import { usePhrases } from './hooks/usePhrases'
import { useRecordPhraseReview } from './hooks/useRecordPhraseReview'
import { useUserSettings } from './hooks/useUserSettings'

export function PhraseSessionPage({ mode }: { mode: SessionMode }) {
  // Pinned at start: a session that runs past midnight keeps its date.
  const [today] = useState(() => todayKey())
  const { data: phrases, isLoading, isError } = usePhrases()
  const { data: settings, isError: settingsError } = useUserSettings()
  const record = useRecordPhraseReview()

  const [queue, setQueue] = useState<SessionItem[] | null>(null)
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<SessionResult[]>([])
  const [saveFailed, setSaveFailed] = useState(false)

  // Snapshot the queue once. Each save refetches phrases; rebuilding from
  // that would drop phrases just reviewed and shift the current index.
  useEffect(() => {
    if (queue || !phrases || (!settings && !settingsError)) return
    const cap = settings?.new_phrases_per_day ?? DEFAULT_NEW_PHRASES_PER_DAY
    if (mode === 'review') {
      const { reviews, fresh } = dueToday(phrases, today, cap)
      setQueue(buildSession([...reviews, ...fresh]))
    } else {
      setQueue(buildSession(practiceSet(phrases, today)))
    }
  }, [queue, phrases, settings, settingsError, mode, today])

  useEffect(() => {
    warmUpGrader()
  }, [])

  const imagePaths = useMemo(
    () => (queue ?? []).flatMap((item) => (item.phrase.image_path ? [item.phrase.image_path] : [])),
    [queue],
  )
  const { data: imageUrls } = useSignedImageUrls(imagePaths)
  useImagePrefetch(useMemo(() => Object.values(imageUrls), [imageUrls]))

  const current = queue?.[index]
  const isComplete = !!queue && queue.length > 0 && index >= queue.length
  const firstPassCount = queue?.filter((item) => !item.isRepeat).length ?? 0

  function handleResolved(item: SessionItem, resolution: Resolution<PhraseOutcome>) {
    const { grade } = resolution.outcome
    const rating = ratingFor({
      correct: resolution.correct,
      attemptCount: resolution.attemptCount,
      verdict: grade.verdict,
    })

    if (!item.isRepeat) {
      const schedule = mode === 'review' ? nextSchedule(item.phrase, rating, today) : null
      // mutateAsync, not mutate's per-call onError: React Query only fires
      // per-call callbacks for the latest mutate, and saves overlap here.
      record
        .mutateAsync({
          phraseId: item.phrase.id,
          reviewedOn: today,
          rating,
          attemptCount: resolution.attemptCount,
          typedAnswer: resolution.typed,
          gradeSource: grade.source,
          jevVerdict: grade.jevVerdict,
          isPractice: mode === 'practice',
          schedule,
        })
        .catch((error) => {
          // A phrase deleted mid-session has nothing to save; skip quietly.
          if (!(error instanceof PhraseNotFoundError)) setSaveFailed(true)
        })
      setResults((r) => [...r, { rating, nextDue: schedule?.due_on ?? null }])
    }

    setQueue((q) => (q ? afterResolved(q, index, rating, mode) : q))
  }

  const summary = summarize(results)

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-4">
      <Link to="/phrases" className="text-muted-foreground text-sm underline underline-offset-4">
        ← Back to phrases
      </Link>

      {mode === 'practice' && (
        <p className="text-muted-foreground text-sm">
          Practice session. Your schedule won't change.
        </p>
      )}

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {isError && <p className="text-destructive text-sm">Couldn't load your phrases.</p>}

      {saveFailed && (
        <p className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm">
          {mode === 'review'
            ? "Couldn't save a result. That phrase will stay due."
            : "Couldn't save a practice result."}
        </p>
      )}

      {queue && queue.length === 0 && (
        <p className="text-muted-foreground">
          Nothing to {mode === 'review' ? 'review' : 'practice'} right now.{' '}
          <Link to="/phrases" className="underline underline-offset-4">
            Back to phrases
          </Link>
        </p>
      )}

      {current && (
        <>
          <p className="text-muted-foreground text-sm">
            {current.isRepeat
              ? 'One more try at the ones you missed'
              : `Phrase ${Math.min(index + 1, firstPassCount)} of ${firstPassCount}`}
          </p>
          <PhraseQuizCard
            key={`${current.phrase.id}:${current.isRepeat}`}
            phrase={current.phrase}
            imageUrl={current.phrase.image_path ? imageUrls[current.phrase.image_path] : undefined}
            onResolved={(resolution) => handleResolved(current, resolution)}
            onNext={() => setIndex((i) => i + 1)}
          />
        </>
      )}

      {isComplete && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <h1 className="text-xl font-semibold">
            {mode === 'review' ? 'Done for today!' : 'Practice done!'}
          </h1>
          <p className="text-muted-foreground">
            {summary.firstTry} right on the first try, {summary.neededMore} needed more.
          </p>
          {summary.nextDue && (
            <p className="text-muted-foreground text-sm">
              Next up {relativeDayLabel(summary.nextDue, today)}.
            </p>
          )}
          <Button asChild>
            <Link to="/phrases">Back to phrases</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
