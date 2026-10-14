import { describe, expect, it } from 'vitest'
import { forecast, nextBusyDay } from './forecast'
import { makePhrase } from './testPhrase'

const TODAY = '2026-10-13'

function scheduled(due_on: string, introduced_on = '2026-10-01') {
  return makePhrase({ due_on, introduced_on, interval_days: 3, reps: 2 })
}

describe('forecast', () => {
  it('returns one entry per day starting today', () => {
    const days = forecast([], TODAY, 10, 3)
    expect(days.map((d) => d.date)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15'])
  })

  it('counts overdue phrases on today, however late they are', () => {
    const days = forecast(
      [scheduled('2026-09-01'), scheduled('2026-10-12'), scheduled('2026-10-13')],
      TODAY,
      10,
      2,
    )
    expect(days[0]).toEqual({ date: TODAY, reviews: 3, newPhrases: 0 })
    expect(days[1].reviews).toBe(0)
  })

  it('counts scheduled reviews on their due dates', () => {
    const days = forecast([scheduled('2026-10-15'), scheduled('2026-10-15')], TODAY, 10, 4)
    expect(days[2]).toEqual({ date: '2026-10-15', reviews: 2, newPhrases: 0 })
  })

  it('releases queued new phrases at the cap, starting with what is left today', () => {
    const introducedToday = scheduled('2026-10-14', TODAY)
    const queued = Array.from({ length: 5 }, () => makePhrase())
    const days = forecast([introducedToday, ...queued], TODAY, 2, 5)
    expect(days.map((d) => d.newPhrases)).toEqual([1, 2, 2, 0, 0])
  })

  it('starts new phrases tomorrow when today’s cap is used up', () => {
    const doneToday = [scheduled('2026-10-14', TODAY), scheduled('2026-10-14', TODAY)]
    const queued = Array.from({ length: 20 }, () => makePhrase())
    const days = forecast([...doneToday, ...queued], TODAY, 2, 3)
    expect(days.map((d) => d.newPhrases)).toEqual([0, 2, 2])
  })
})

describe('nextBusyDay', () => {
  it('finds the first day after today with anything due', () => {
    const days = forecast([scheduled('2026-10-16')], TODAY, 10, 10)
    expect(nextBusyDay(days, TODAY)).toEqual({ date: '2026-10-16', reviews: 1, newPhrases: 0 })
  })

  it('is null when nothing is coming up', () => {
    expect(nextBusyDay(forecast([], TODAY, 10, 10), TODAY)).toBeNull()
  })
})
