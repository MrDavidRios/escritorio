import { useState, type FormEvent } from 'react'
import { AccentedCharPad } from '@/components/AccentedCharPad'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCursorInsert } from '@/hooks/useCursorInsert'
import { isAnswerCorrect } from '@/lib/grading'
import type { Question } from './studyMode'
import { useLogQuizAttempt } from './hooks/useLogQuizAttempt'

const MAX_ATTEMPTS = 3

type Feedback = 'correct' | 'retry' | 'revealed' | null

/**
 * One quiz question: prompt (conversion mode's word, or meaning mode's
 * image/definition) + a typed-answer input, with immediate right/wrong
 * feedback. Mount fresh per card (parent keys it by card.id) so all
 * local state resets between cards automatically.
 *
 * A wrong answer gets up to MAX_ATTEMPTS tries before revealing the
 * correct answer -- only a correct answer or the final wrong attempt
 * locks the input and advances to "Next".
 */
export function QuizCard({
  question,
  imageUrl,
  sessionId,
  onCorrect,
  onNext,
}: {
  question: Question
  imageUrl: string | undefined
  sessionId: string | null
  onCorrect: () => void
  onNext: () => void
}) {
  const { card } = question
  const [value, setValue] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [hintShown, setHintShown] = useState(false)

  const cursor = useCursorInsert(() => value, setValue)
  const locked = feedback === 'correct' || feedback === 'revealed'
  const logAttempt = useLogQuizAttempt()

  function logResult(isCorrect: boolean, attemptCount: number) {
    logAttempt.mutate({
      card_id: card.id,
      is_correct: isCorrect,
      attempt_count: attemptCount,
      session_id: sessionId,
      resolved_direction: question.resolvedDirection,
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (locked) {
      onNext()
      return
    }

    if (isAnswerCorrect(value, question.expectedAnswer)) {
      setFeedback('correct')
      logResult(true, attempts + 1)
      onCorrect()
      return
    }

    const nextAttempts = attempts + 1
    setAttempts(nextAttempts)
    if (nextAttempts >= MAX_ATTEMPTS) {
      setFeedback('revealed')
      logResult(false, nextAttempts)
    } else {
      setFeedback('retry')
      setValue('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {question.showImage && card.image_path && (
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

      {question.showDefinition && card.definition && (
        <div
          className={
            !(question.showImage && card.image_path)
              ? 'bg-muted/30 flex min-h-48 items-center justify-center overflow-hidden rounded-lg border p-6'
              : undefined
          }
        >
          <p className="text-base leading-relaxed">{card.definition}</p>
        </div>
      )}

      {!question.showImage && !question.showDefinition && (
        <div className="bg-muted/30 flex min-h-32 items-center justify-center overflow-hidden rounded-lg border p-6">
          <p className="text-xl font-medium">{question.prompt}</p>
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
        {question.answerLanguage === 'es' && (
          <AccentedCharPad onInsert={locked ? () => {} : cursor.insert} />
        )}
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
          Not quite. The answer was: {question.expectedAnswer}
        </p>
      )}

      <Button type="submit">{locked ? 'Next' : 'Check'}</Button>
    </form>
  )
}
