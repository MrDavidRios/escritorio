import type { DateKey, Phrase, PhraseRating } from '@/types/phrase'

export type SessionMode = 'review' | 'practice'

export interface SessionItem {
  phrase: Phrase
  /** End-of-session repeat of a missed phrase: shown, never saved. */
  isRepeat: boolean
}

export interface SessionResult {
  rating: PhraseRating
  /** The new due date for a scheduled review; null for practice. */
  nextDue: DateKey | null
}

export function buildSession(phrases: Phrase[]): SessionItem[] {
  return phrases.map((phrase) => ({ phrase, isRepeat: false }))
}

/**
 * In a review session, a phrase missed on its first pass comes back once at
 * the end so the learner leaves having typed it correctly. Repeats never
 * re-queue, so the session always ends.
 */
export function afterResolved(
  queue: SessionItem[],
  index: number,
  rating: PhraseRating,
  mode: SessionMode,
): SessionItem[] {
  const item = queue[index]
  if (mode !== 'review' || rating !== 'again' || item.isRepeat) return queue
  return [...queue, { phrase: item.phrase, isRepeat: true }]
}

export function summarize(results: SessionResult[]): {
  firstTry: number
  neededMore: number
  nextDue: DateKey | null
} {
  const firstTry = results.filter((r) => r.rating === 'good').length
  const dueDates = results.flatMap((r) => (r.nextDue ? [r.nextDue] : [])).sort()
  return { firstTry, neededMore: results.length - firstTry, nextDue: dueDates[0] ?? null }
}
