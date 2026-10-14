import { useState, type FormEvent, type ReactNode } from 'react'
import { AccentedCharPad } from '@/components/AccentedCharPad'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCursorInsert } from '@/hooks/useCursorInsert'
import {
  applyGrade,
  INITIAL_ANSWER_STATE,
  isLocked,
  type AnswerState,
  type GradeOutcome,
  type Resolution,
} from './typedAnswerState'

/**
 * A typed-answer question: caller-supplied prompt, an answer input, and
 * attempt/feedback handling (see applyGrade). Grading is delegated to
 * `grade`, which may be async (e.g. a network grader) and should not reject;
 * a rejection is treated as "try again" (no attempt consumed, input kept).
 * Mount fresh per question (parent keys it) so local state resets.
 */
export function TypedAnswerQuiz<G extends GradeOutcome>({
  prompt,
  expectedAnswer,
  answerLang,
  showAccentPad,
  grade,
  onResolved,
  onNext,
}: {
  prompt: ReactNode
  expectedAnswer: string
  /** Language code of the expected answer, so screen readers pronounce it correctly. */
  answerLang?: string
  showAccentPad: boolean
  grade: (typed: string) => Promise<G>
  onResolved: (resolution: Resolution<G>) => void
  onNext: () => void
}) {
  const [value, setValue] = useState('')
  const [state, setState] = useState<AnswerState>(INITIAL_ANSWER_STATE)
  const [checking, setChecking] = useState(false)

  const cursor = useCursorInsert(() => value, setValue)
  const locked = isLocked(state)
  const feedback = state.feedback

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (locked) {
      onNext()
      return
    }
    if (checking) return

    const typed = value
    setChecking(true)
    let outcome: G
    try {
      outcome = await grade(typed)
    } catch {
      // Grader failure is "try again", not a graded attempt: keep the
      // answer state and the typed value untouched.
      return
    } finally {
      setChecking(false)
    }

    const { state: next, resolution } = applyGrade(state, typed, outcome)
    setState(next)
    if (resolution) onResolved(resolution)
    else setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {prompt}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quiz-answer">Your answer</Label>
        {showAccentPad && <AccentedCharPad onInsert={locked ? () => {} : cursor.insert} />}
        <Input
          id="quiz-answer"
          autoComplete="off"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          readOnly={locked || checking}
          className={locked ? 'text-muted-foreground' : undefined}
          ref={(el) => cursor.setRef(el)}
        />
      </div>

      <div aria-live="polite" className="contents">
        {feedback?.kind === 'correct' && (
          <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {feedback.note ?? 'Correct!'}
          </p>
        )}
        {feedback?.kind === 'retry' && (
          <p className="text-destructive text-sm font-medium">
            Not quite. {feedback.attemptsLeft} attempt{feedback.attemptsLeft === 1 ? '' : 's'} left.
          </p>
        )}
        {feedback?.kind === 'revealed' && (
          <p className="text-destructive text-sm font-medium">
            Not quite. The answer was: <span lang={answerLang}>{expectedAnswer}</span>
          </p>
        )}
      </div>

      <Button type="submit" disabled={checking}>
        {locked ? 'Next' : checking ? 'Checking…' : 'Check'}
      </Button>
    </form>
  )
}
