import type { DateKey, Phrase } from '@/types/phrase'

export const PRACTICE_SESSION_SIZE = 10

function byCreated(a: Phrase, b: Phrase): number {
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
}

function byDueThenCreated(a: Phrase, b: Phrase): number {
  return a.due_on!.localeCompare(b.due_on!) || byCreated(a, b)
}

/** How many more new phrases may be introduced today. */
export function newAllowanceToday(phrases: Phrase[], today: DateKey, cap: number): number {
  const introducedToday = phrases.filter((p) => p.introduced_on === today).length
  return Math.max(0, cap - introducedToday)
}

/**
 * Today's due session: scheduled phrases due today or earlier (overdue
 * rolls into today, most overdue first), then new phrases oldest-first up
 * to what's left of the daily cap.
 */
export function dueToday(
  phrases: Phrase[],
  today: DateKey,
  cap: number,
): { reviews: Phrase[]; fresh: Phrase[] } {
  const reviews = phrases
    .filter((p) => p.due_on !== null && p.due_on <= today)
    .sort(byDueThenCreated)
  const fresh = phrases
    .filter((p) => p.due_on === null)
    .sort(byCreated)
    .slice(0, newAllowanceToday(phrases, today, cap))
  return { reviews, fresh }
}

/**
 * Practice-ahead: introduced phrases not yet due, soonest first. New phrases
 * stay in their queue so practice never sidesteps the daily cap.
 */
export function practiceSet(
  phrases: Phrase[],
  today: DateKey,
  size: number = PRACTICE_SESSION_SIZE,
): Phrase[] {
  return phrases
    .filter((p) => p.due_on !== null && p.due_on > today)
    .sort(byDueThenCreated)
    .slice(0, size)
}
