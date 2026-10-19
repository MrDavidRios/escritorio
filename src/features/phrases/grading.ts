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

  // The async wrapper turns a synchronous throw into a rejection handled below.
  const call = (async () =>
    callJev({ english: phrase.english, expected: phrase.spanish, typed }, controller.signal))()
  // If the timeout wins, the abandoned call may still reject later.
  call.catch(() => {})

  try {
    const grade = await Promise.race([call, timeout])
    if (grade.confidence < JEV_CONFIDENCE_THRESHOLD) return strictFallback(grade.verdict)
    // A minor slip is the right phrase misspelled: rejected so the learner
    // fixes the spelling (see isMisspelling), not accepted as a near miss.
    // An exact match never gets here, so Jev saying "exact" is a slip too.
    const verdict = grade.verdict === 'exact' ? 'minor_slip' : grade.verdict
    return {
      correct: verdict === 'valid_variant',
      verdict,
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
}: {
  correct: boolean
  attemptCount: number
}): PhraseRating {
  if (!correct) return 'again'
  if (attemptCount > 1) return 'hard'
  return 'good'
}

/**
 * Jev judged the answer the right phrase with a spelling slip ("exact" on a
 * non-matching answer counts too). Ignores confidence: it only changes the
 * feedback wording on a rejected answer.
 */
export function isMisspelling(grade: PhraseGrade): boolean {
  return grade.jevVerdict === 'minor_slip' || grade.jevVerdict === 'exact'
}

/** Shown instead of "Correct!" when an answer was accepted but wasn't the exact form. */
export function feedbackNote(grade: PhraseGrade, expected: string): string | null {
  if (!grade.correct) return null
  if (grade.verdict === 'valid_variant') {
    return `Accepted. Exact form: ${expected}`
  }
  return null
}
