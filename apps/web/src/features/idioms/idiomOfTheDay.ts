import type { Idiom } from '@/types/idiom'

const MS_PER_DAY = 86_400_000

/** Local calendar date as YYYY-MM-DD, matching the `featured_on` column format. */
export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Whole days since the Unix epoch for the local calendar date, immune to DST shifts. */
function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY)
}

/**
 * Picks the idiom to show on `date`: the one pinned to that local date if any, otherwise a
 * deterministic rotation through the unpinned idioms (ordered by `seq`), one per day.
 * Pinned idioms are excluded from the rotation so they only appear on their own date.
 */
export function pickIdiomOfTheDay(idioms: Idiom[], date: Date): Idiom | null {
  const key = localDateKey(date)
  const pinned = idioms.find((idiom) => idiom.featured_on === key)
  if (pinned) return pinned

  const rotation = idioms
    .filter((idiom) => idiom.featured_on === null)
    .sort((a, b) => a.seq - b.seq)
  if (rotation.length === 0) return null

  const index = ((localDayNumber(date) % rotation.length) + rotation.length) % rotation.length
  return rotation[index]
}

/** The local calendar date `days` before `date`, at local midnight (DST-safe). */
export function subtractDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - days)
}

/** "Today", "Yesterday", or a short date like "Oct 1" for `date`, relative to `today`. */
export function dayLabel(today: Date, daysAgo: number): string {
  if (daysAgo === 0) return 'Today'
  if (daysAgo === 1) return 'Yesterday'
  return subtractDays(today, daysAgo).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/** Whole calendar days from `date` to `today` (0 for the same local date, 1 for yesterday). */
export function daysAgo(today: Date, date: Date): number {
  return localDayNumber(today) - localDayNumber(date)
}
