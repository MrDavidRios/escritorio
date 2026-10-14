import type { DateKey, Phrase } from '@/types/phrase'
import { newAllowanceToday } from './dailyQueue'
import { addDays } from './dates'

/** A little over a year, so the calendar can page ~12 months ahead. */
export const FORECAST_DAYS = 400

export interface ForecastDay {
  date: DateKey
  reviews: number
  newPhrases: number
}

/**
 * Due counts per day for the current schedule: scheduled reviews on their
 * due_on (overdue counted today), plus queued new phrases released at the
 * daily cap. It doesn't simulate future review outcomes.
 */
export function forecast(
  phrases: Phrase[],
  today: DateKey,
  cap: number,
  days: number,
): ForecastDay[] {
  const reviewsByDate = new Map<DateKey, number>()
  for (const phrase of phrases) {
    if (phrase.due_on === null) continue
    const date = phrase.due_on < today ? today : phrase.due_on
    reviewsByDate.set(date, (reviewsByDate.get(date) ?? 0) + 1)
  }

  let queued = phrases.filter((p) => p.due_on === null).length
  const result: ForecastDay[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i)
    const allowance = i === 0 ? newAllowanceToday(phrases, today, cap) : cap
    const newPhrases = Math.min(queued, allowance)
    queued -= newPhrases
    result.push({ date, reviews: reviewsByDate.get(date) ?? 0, newPhrases })
  }
  return result
}

/** The first day after today with anything due, for "Next 5 due Thursday". */
export function nextBusyDay(days: ForecastDay[], today: DateKey): ForecastDay | null {
  return days.find((d) => d.date > today && d.reviews + d.newPhrases > 0) ?? null
}
