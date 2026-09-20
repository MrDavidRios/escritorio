import { useState, type FormEvent } from 'react'
import { AccentedCharPad } from '@/components/AccentedCharPad'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCursorInsert } from '@/hooks/useCursorInsert'
import { isAnswerCorrect } from '@/lib/grading'
import type { Card } from '@/types/card'
import { useLogQuizAttempt } from './hooks/useLogQuizAttempt'

const MAX_ATTEMPTS = 3

type Feedback = 'correct' | 'retry' | 'revealed' | null

/**
 * One quiz question: image + optional hint, a typed-answer input, and
 * immediate right/wrong feedback. Mount fresh per card (parent keys it by
 * card.id) so all local state resets between cards automatically.
 *
 * A wrong answer gets up to MAX_ATTEMPTS tries before revealing the
 * correct answer -- only a correct answer or the final wrong attempt
 * locks the input and advances to "Next".
 */
export function QuizCard({
  card,
  imageUrl,
  onNext,
}: {
  card: Card
  imageUrl: string | undefined
  onNext: () => void
}) {
  const [value, setValue] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [hintShown, setHintShown] = useState(false)

  const cursor = useCursorInsert(() => value, setValue)
  const locked = feedback === 'correct' || feedback === 'revealed'
  const logAttempt = useLogQuizAttempt()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (locked) {
      onNext()
      return
    }

    if (isAnswerCorrect(value, card.spanish_term)) {
      setFeedback('correct')
      logAttempt.mutate({ card_id: card.id, is_correct: true, attempt_count: attempts + 1 })
      return
    }

    const nextAttempts = attempts + 1
    setAttempts(nextAttempts)
    if (nextAttempts >= MAX_ATTEMPTS) {
      setFeedback('revealed')
      logAttempt.mutate({ card_id: card.id, is_correct: false, attempt_count: nextAttempts })
    } else {
      setFeedback('retry')
      setValue('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {card.image_path && (
        <div className="bg-muted/30 flex min-h-48 items-center justify-center overflow-hidden rounded-lg border">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              decoding="async"
              className="max-h-72 w-full object-contain"
            />
          ) : (
            <p className="text-muted-foreground p-8 text-sm">Loading image…</p>
          )}
        </div>
      )}

      {card.definition && (
        <div
          className={
            !card.image_path
              ? 'bg-muted/30 flex min-h-48 items-center justify-center overflow-hidden rounded-lg border p-6'
              : undefined
          }
        >
          <p className="text-base leading-relaxed">{card.definition}</p>
        </div>
      )}

      {card.hint &&
        (hintShown ? (
          <p className="text-muted-foreground text-sm">Hint: {card.hint}</p>
        ) : (
          <button
            type="button"
            className="text-muted-foreground self-start text-sm underline underline-offset-2"
            onClick={() => setHintShown(true)}
          >
            Show hint
          </button>
        ))}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quiz-answer">Your answer</Label>
        <AccentedCharPad onInsert={locked ? () => {} : cursor.insert} />
        <Input
          id="quiz-answer"
          autoComplete="off"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          readOnly={locked}
          className={locked ? 'text-muted-foreground' : undefined}
          ref={(el) => cursor.setRef(el)}
        />
      </div>

      {feedback === 'correct' && (
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Correct!</p>
      )}
      {feedback === 'retry' && (
        <p className="text-destructive text-sm font-medium">
          Not quite. {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts === 1 ? '' : 's'}{' '}
          left.
        </p>
      )}
      {feedback === 'revealed' && (
        <p className="text-destructive text-sm font-medium">
          Not quite. The answer was: {card.spanish_term}
        </p>
      )}

      <Button type="submit">{locked ? 'Next' : 'Check'}</Button>
    </form>
  )
}
