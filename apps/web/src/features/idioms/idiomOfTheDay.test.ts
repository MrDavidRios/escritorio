import { describe, expect, it } from 'vitest'
import type { Idiom } from '@/types/idiom'
import { dayLabel, daysAgo, localDateKey, pickIdiomOfTheDay, subtractDays } from './idiomOfTheDay'

function makeIdiom(seq: number, overrides: Partial<Idiom> = {}): Idiom {
  return {
    id: `idiom-${seq}`,
    seq,
    spanish: `frase ${seq}`,
    english: `phrase ${seq}`,
    example: null,
    source_url: 'https://en.wiktionary.org/wiki/frase',
    featured_on: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const idioms = [makeIdiom(1), makeIdiom(2), makeIdiom(3)]

describe('localDateKey', () => {
  it('formats the local calendar date as YYYY-MM-DD', () => {
    expect(localDateKey(new Date(2026, 9, 3, 23, 59))).toBe('2026-10-03')
    expect(localDateKey(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05')
  })
})

describe('pickIdiomOfTheDay', () => {
  it('returns null for an empty list', () => {
    expect(pickIdiomOfTheDay([], new Date(2026, 9, 3))).toBeNull()
  })

  it('returns the same idiom for any time on the same local date', () => {
    const morning = pickIdiomOfTheDay(idioms, new Date(2026, 9, 3, 0, 0))
    const night = pickIdiomOfTheDay(idioms, new Date(2026, 9, 3, 23, 59))
    expect(morning).not.toBeNull()
    expect(night).toEqual(morning)
  })

  it('advances one idiom per day and wraps around', () => {
    const day = (d: number) => pickIdiomOfTheDay(idioms, new Date(2026, 9, d))?.seq
    const first = day(1)!
    const next = (seq: number) => (seq % idioms.length) + 1
    expect(day(2)).toBe(next(first))
    expect(day(3)).toBe(next(next(first)))
    expect(day(4)).toBe(first)
  })

  it('does not depend on the order of the input array', () => {
    const shuffled = [idioms[2], idioms[0], idioms[1]]
    const date = new Date(2026, 9, 3)
    expect(pickIdiomOfTheDay(shuffled, date)).toEqual(pickIdiomOfTheDay(idioms, date))
  })

  it('returns the pinned idiom on its date', () => {
    const pinned = makeIdiom(4, { featured_on: '2026-10-03' })
    expect(pickIdiomOfTheDay([...idioms, pinned], new Date(2026, 9, 3))).toEqual(pinned)
  })

  it('keeps pinned idioms out of the rotation on other dates', () => {
    const pinned = makeIdiom(4, { featured_on: '2026-12-25' })
    const all = [...idioms, pinned]
    for (let d = 1; d <= 30; d++) {
      expect(pickIdiomOfTheDay(all, new Date(2026, 9, d))?.id).not.toBe(pinned.id)
    }
  })

  it('returns null when every idiom is pinned to some other date', () => {
    const onlyPinned = [makeIdiom(1, { featured_on: '2026-12-25' })]
    expect(pickIdiomOfTheDay(onlyPinned, new Date(2026, 9, 3))).toBeNull()
  })
})

describe('subtractDays', () => {
  it('returns the same calendar date for 0 days', () => {
    expect(localDateKey(subtractDays(new Date(2026, 9, 3, 15, 30), 0))).toBe('2026-10-03')
  })

  it('crosses month and year boundaries', () => {
    expect(localDateKey(subtractDays(new Date(2026, 9, 1), 1))).toBe('2026-09-30')
    expect(localDateKey(subtractDays(new Date(2026, 0, 1), 1))).toBe('2025-12-31')
  })

  it('counts calendar days across a DST change, not 24-hour blocks', () => {
    // US DST ends Sun 2026-11-01; going back from Mon 11-02 must land on Sun 11-01 and Sat 10-31.
    expect(localDateKey(subtractDays(new Date(2026, 10, 2, 0, 30), 1))).toBe('2026-11-01')
    expect(localDateKey(subtractDays(new Date(2026, 10, 2, 0, 30), 2))).toBe('2026-10-31')
  })
})

describe('dayLabel', () => {
  const today = new Date(2026, 9, 3)

  it('labels today and yesterday', () => {
    expect(dayLabel(today, 0)).toBe('Today')
    expect(dayLabel(today, 1)).toBe('Yesterday')
  })

  it('labels older days with a short month and day', () => {
    expect(dayLabel(today, 2)).toBe('Oct 1')
    expect(dayLabel(today, 3)).toBe('Sep 30')
  })
})

describe('daysAgo', () => {
  const today = new Date(2026, 9, 3, 18, 45)

  it('is 0 for the same calendar date, whatever the time of day', () => {
    expect(daysAgo(today, new Date(2026, 9, 3, 0, 0))).toBe(0)
  })

  it('counts calendar days back, across month boundaries', () => {
    expect(daysAgo(today, new Date(2026, 9, 2))).toBe(1)
    expect(daysAgo(today, new Date(2026, 8, 28))).toBe(5)
  })

  it('counts calendar days across a DST change', () => {
    expect(daysAgo(new Date(2026, 10, 2, 0, 30), new Date(2026, 9, 31))).toBe(2)
  })

  it('round-trips with subtractDays', () => {
    expect(daysAgo(today, subtractDays(today, 17))).toBe(17)
  })
})
