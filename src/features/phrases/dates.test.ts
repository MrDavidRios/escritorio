import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  longDate,
  parseDateKey,
  relativeDayLabel,
  shortDate,
  todayKey,
} from './dates'

describe('todayKey', () => {
  it('uses the local calendar date, whatever the time of day', () => {
    expect(todayKey(new Date(2026, 9, 13, 0, 1))).toBe('2026-10-13')
    expect(todayKey(new Date(2026, 9, 13, 23, 59))).toBe('2026-10-13')
  })
})

describe('parseDateKey', () => {
  it('returns local midnight of that date', () => {
    const d = parseDateKey('2026-10-13')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 13, 0])
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('counts calendar days across a DST change', () => {
    // US DST ends Sun 2026-11-01.
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02')
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09')
  })

  it('handles negative offsets', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('daysBetween', () => {
  it('counts whole calendar days from one key to another', () => {
    expect(daysBetween('2026-10-13', '2026-10-20')).toBe(7)
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
    expect(daysBetween('2026-10-20', '2026-10-13')).toBe(-7)
  })
})

describe('labels', () => {
  it('shortDate is month + day', () => {
    expect(shortDate('2026-10-21')).toBe('Oct 21')
  })

  it('longDate includes the weekday', () => {
    expect(longDate('2026-10-17')).toBe('Sat, Oct 17')
  })

  it('relativeDayLabel says tomorrow, a weekday within a week, else a short date', () => {
    expect(relativeDayLabel('2026-10-13', '2026-10-13')).toBe('today')
    expect(relativeDayLabel('2026-10-14', '2026-10-13')).toBe('tomorrow')
    expect(relativeDayLabel('2026-10-15', '2026-10-13')).toBe('Thursday')
    expect(relativeDayLabel('2026-10-19', '2026-10-13')).toBe('Monday')
    expect(relativeDayLabel('2026-10-20', '2026-10-13')).toBe('Oct 20')
  })
})
