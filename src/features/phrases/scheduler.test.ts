import { describe, expect, it } from 'vitest'
import type { PhraseRating, PhraseSchedule } from '@/types/phrase'
import { nextSchedule } from './scheduler'

const TODAY = '2026-10-13'

const NEW: PhraseSchedule = {
  due_on: null,
  introduced_on: null,
  interval_days: 0,
  ease: 2,
  reps: 0,
  lapses: 0,
}

function run(ratings: PhraseRating[], start: PhraseSchedule = NEW) {
  let schedule = start
  const intervals: number[] = []
  for (const rating of ratings) {
    const next = nextSchedule(schedule, rating, TODAY)
    intervals.push(next.interval_days)
    schedule = { ...schedule, ...next }
  }
  return { intervals, final: schedule }
}

describe('nextSchedule', () => {
  it('follows 1, 3, 7, 14, 28, 56, 112 on a perfect run', () => {
    expect(run(Array<PhraseRating>(7).fill('good')).intervals).toEqual([1, 3, 7, 14, 28, 56, 112])
  })

  it('sets due_on to today + interval, across month boundaries', () => {
    expect(nextSchedule(NEW, 'good', '2026-10-31').due_on).toBe('2026-11-01')
  })

  it('counts every scheduled review in reps', () => {
    expect(run(['good', 'hard', 'again']).final.reps).toBe(3)
  })

  it('still uses the learning steps when a new phrase starts with a hard', () => {
    expect(run(['hard', 'good', 'good']).intervals).toEqual([1, 3, 7])
  })

  it('hard on a new phrase is 1 day and costs 0.15 ease', () => {
    const next = nextSchedule(NEW, 'hard', TODAY)
    expect(next.interval_days).toBe(1)
    expect(next.ease).toBe(1.85)
  })

  it('hard grows the interval by 1.2x, at least +1 day', () => {
    expect(nextSchedule({ ...NEW, interval_days: 10, reps: 5 }, 'hard', TODAY).interval_days).toBe(
      12,
    )
    expect(nextSchedule({ ...NEW, interval_days: 3, reps: 2 }, 'hard', TODAY).interval_days).toBe(4)
  })

  it('again resets to 1 day, costs 0.2 ease, and counts a lapse', () => {
    const next = nextSchedule({ ...NEW, interval_days: 28, reps: 5, ease: 2 }, 'again', TODAY)
    expect(next).toMatchObject({ interval_days: 1, ease: 1.8, lapses: 1, due_on: '2026-10-14' })
  })

  it('never drops ease below 1.3', () => {
    expect(
      nextSchedule({ ...NEW, ease: 1.4, interval_days: 5, reps: 4 }, 'again', TODAY).ease,
    ).toBe(1.3)
    expect(
      nextSchedule({ ...NEW, ease: 1.35, interval_days: 5, reps: 4 }, 'hard', TODAY).ease,
    ).toBe(1.3)
  })

  it('good recovers ease by 0.05, capped at 2.0', () => {
    const recovering = nextSchedule(
      { ...NEW, ease: 1.7, interval_days: 10, reps: 5 },
      'good',
      TODAY,
    )
    expect(recovering).toMatchObject({ ease: 1.75, interval_days: 17 })
    expect(
      nextSchedule({ ...NEW, ease: 1.98, interval_days: 10, reps: 5 }, 'good', TODAY).ease,
    ).toBe(2)
  })

  it('relearning after a lapse multiplies by ease instead of replaying the steps', () => {
    const lapsed = { ...NEW, interval_days: 1, reps: 6, lapses: 1, ease: 1.8 }
    expect(nextSchedule(lapsed, 'good', TODAY).interval_days).toBe(2)
  })
})
