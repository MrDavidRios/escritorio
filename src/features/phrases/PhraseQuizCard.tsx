import { useRef } from 'react'
import { callGradePhrase } from '@/api/gradePhrase'
import { TypedAnswerQuiz } from '@/components/TypedAnswerQuiz'
import type { GradeOutcome, Resolution } from '@/components/typedAnswerState'
import type { Phrase } from '@/types/phrase'
import { feedbackNote, gradePhrase, isMisspelling, type PhraseGrade } from './grading'
import { spellingHint } from './spellingHint'

const MISSPELLING_NOTE = 'The content is correct, but the spelling is wrong.'

export interface PhraseOutcome extends GradeOutcome {
  grade: PhraseGrade
}

/**
 * One phrase question: English (+ optional image) prompt, typed Spanish
 * answer graded by exact match then Jev. A misspelling is rejected with its
 * own message; from the second one on, a hint blanks the wrong letters.
 * Saving is the parent's job. Mount
 * fresh per item (parent keys it).
 */
export function PhraseQuizCard({
  phrase,
  imageUrl,
  onResolved,
  onNext,
}: {
  phrase: Phrase
  imageUrl: string | undefined
  onResolved: (resolution: Resolution<PhraseOutcome>) => void
  onNext: () => void
}) {
  const misspellings = useRef(0)

  const prompt = (
    <>
      {phrase.image_path && (
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
      <div className="bg-muted/30 flex min-h-32 items-center justify-center rounded-lg border p-6">
        <p className="text-center text-xl font-medium">{phrase.english}</p>
      </div>
    </>
  )

  return (
    <TypedAnswerQuiz<PhraseOutcome>
      prompt={prompt}
      expectedAnswer={phrase.spanish}
      answerLang="es"
      showAccentPad
      grade={async (typed) => {
        const grade = await gradePhrase(typed, phrase, callGradePhrase)
        const misspelled = !grade.correct && isMisspelling(grade)
        if (misspelled) misspellings.current++
        return {
          correct: grade.correct,
          note: feedbackNote(grade, phrase.spanish),
          missNote: misspelled ? MISSPELLING_NOTE : null,
          hint:
            misspelled && misspellings.current >= 2 ? spellingHint(typed, phrase.spanish) : null,
          grade,
        }
      }}
      onResolved={onResolved}
      onNext={onNext}
    />
  )
}
