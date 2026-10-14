import { useState } from 'react'
import { TypedAnswerQuiz } from '@/components/TypedAnswerQuiz'
import { isAnswerCorrect } from '@/lib/grading'
import type { Question } from './studyMode'
import { useLogQuizAttempt } from './hooks/useLogQuizAttempt'

/**
 * One study-set quiz question: the prompt (conversion mode's word, or
 * meaning mode's image/definition) on top of TypedAnswerQuiz, graded by
 * exact match and logged to quiz_attempts. Mount fresh per card (parent
 * keys it by card.id) so all local state resets between cards.
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
  const [hintShown, setHintShown] = useState(false)
  const logAttempt = useLogQuizAttempt()

  const prompt = (
    <>
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
    </>
  )

  return (
    <TypedAnswerQuiz
      prompt={prompt}
      expectedAnswer={question.expectedAnswer}
      showAccentPad={question.answerLanguage === 'es'}
      grade={async (typed) => ({ correct: isAnswerCorrect(typed, question.expectedAnswer) })}
      onResolved={({ correct, attemptCount }) => {
        logAttempt.mutate({
          card_id: card.id,
          is_correct: correct,
          attempt_count: attemptCount,
          session_id: sessionId,
          resolved_direction: question.resolvedDirection,
        })
        if (correct) onCorrect()
      }}
      onNext={onNext}
    />
  )
}
