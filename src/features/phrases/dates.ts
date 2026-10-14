import { localDateKey } from '@/features/idioms/idiomOfTheDay'
import type { DateKey } from '@/types/phrase'

const MS_PER_DAY = 86_400_000

export function todayKey(now: Date = new Date()): DateKey {
  return localDateKey(now)
}

/** Local midnight of `key`. */
export function parseDateKey(key: DateKey): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** The calendar date `days` after `key` (negative goes back). DST-safe. */
export function addDays(key: DateKey, days: number): DateKey {
  const date = parseDateKey(key)
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days))
}

/** Whole calendar days from `from` to `to`. */
export function daysBetween(from: DateKey, to: DateKey): number {
  const utc = (key: DateKey) => {
    const [year, month, day] = key.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  return Math.round((utc(to) - utc(from)) / MS_PER_DAY)
}

/** "Oct 21" */
export function shortDate(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "Sat, Oct 17" */
export function longDate(key: DateKey): string {
  return parseDateKey(key).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** "today", "tomorrow", a weekday name within the coming week, else "Oct 21". */
export function relativeDayLabel(key: DateKey, today: DateKey): string {
  const days = daysBetween(today, key)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days > 1 && days < 7) {
    return parseDateKey(key).toLocaleDateString('en-US', { weekday: 'long' })
  }
  return shortDate(key)
}
