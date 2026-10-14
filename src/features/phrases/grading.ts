import { isAnswerCorrect, normalizeAnswer } from '@/lib/grading'
import type { JevVerdict, PhraseGradeSource, PhraseRating } from '@/types/phrase'

export const JEV_CONFIDENCE_THRESHOLD = 0.6
/** Covers a cold Edge Function start plus Jev's worst-case latency. */
export const JEV_TIMEOUT_MS = 4000

export interface JevGradeRequest {
  english: string
  expected: string
  typed: string
}

export interface JevGrade {
  verdict: JevVerdict
  confidence: number
}

export type JevGrader = (request: JevGradeRequest, signal: AbortSignal) => Promise<JevGrade>

export interface PhraseGrade {
  correct: boolean
  /** The verdict this grade acts on (strict fallbacks act as 'wrong'). */
  verdict: JevVerdict
  source: PhraseGradeSource
  /** What Jev answered, if it answered at all -- kept for the review log. */
  jevVerdict: JevVerdict | null
}

function strictFallback(jevVerdict: JevVerdict | null): PhraseGrade {
  return { correct: false, verdict: 'wrong', source: 'fallback', jevVerdict }
}

/**
 * Exact match first (no network); otherwise ask Jev. Never rejects: any Jev
 * failure, timeout, or low-confidence answer falls back to strict grading,
 * so a session can't get stuck on the grader.
 */
export async function gradePhrase(
  typed: string,
  phrase: { english: string; spanish: string },
  callJev: JevGrader,
  timeoutMs: number = JEV_TIMEOUT_MS,
): Promise<PhraseGrade> {
  if (isAnswerCorrect(typed, phrase.spanish)) {
    return { correct: true, verdict: 'exact', source: 'exact', jevVerdict: null }
  }
  if (normalizeAnswer(typed) === '') {
    return { correct: false, verdict: 'wrong', source: 'exact', jevVerdict: null }
  }

  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error('Jev grading timed out'))
    }, timeoutMs)
  })

  const call = callJev(
    { english: phrase.english, expected: phrase.spanish, typed },
    controller.signal,
  )
  // If the timeout wins, the abandoned call may still reject later.
  call.catch(() => {})

  try {
    const grade = await Promise.race([call, timeout])
    if (grade.confidence < JEV_CONFIDENCE_THRESHOLD) return strictFallback(grade.verdict)
    return {
      correct: grade.verdict !== 'wrong',
      verdict: grade.verdict,
      source: 'jev',
      jevVerdict: grade.verdict,
    }
  } catch {
    return strictFallback(null)
  } finally {
    clearTimeout(timer)
  }
}

export function ratingFor({
  correct,
  attemptCount,
  verdict,
}: {
  correct: boolean
  attemptCount: number
  verdict: JevVerdict
}): PhraseRating {
  if (!correct) return 'again'
  if (attemptCount > 1 || verdict === 'minor_slip') return 'hard'
  return 'good'
}

/** Shown instead of "Correct!" when an answer was accepted but wasn't the exact form. */
export function feedbackNote(grade: PhraseGrade, expected: string): string | null {
  if (!grade.correct) return null
  if (grade.verdict === 'minor_slip' || grade.verdict === 'valid_variant') {
    return `Accepted. Exact form: ${expected}`
  }
  return null
}
