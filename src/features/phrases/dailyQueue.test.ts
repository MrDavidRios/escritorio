import { describe, expect, it } from 'vitest'
import { dueToday, newAllowanceToday, practiceSet } from './dailyQueue'
import { makePhrase } from './testPhrase'

const TODAY = '2026-10-13'

function introduced(due_on: string, extra: Parameters<typeof makePhrase>[0] = {}) {
  return makePhrase({ due_on, introduced_on: '2026-10-01', interval_days: 3, reps: 2, ...extra })
}

describe('dueToday', () => {
  it('includes phrases due today and overdue ones, most overdue first', () => {
    const today = introduced('2026-10-13')
    const weekLate = introduced('2026-10-06')
    const dayLate = introduced('2026-10-12')
    const future = introduced('2026-10-14')
    const { reviews } = dueToday([today, future, dayLate, weekLate], TODAY, 10)
    expect(reviews.map((p) => p.id)).toEqual([weekLate.id, dayLate.id, today.id])
  })

  it('releases new phrases oldest first, up to the cap', () => {
    const a = makePhrase({ created_at: '2026-10-01T00:00:00Z' })
    const b = makePhrase({ created_at: '2026-10-02T00:00:00Z' })
    const c = makePhrase({ created_at: '2026-10-03T00:00:00Z' })
    const { fresh } = dueToday([c, a, b], TODAY, 2)
    expect(fresh.map((p) => p.id)).toEqual([a.id, b.id])
  })

  it('counts phrases already introduced today against the cap', () => {
    const doneToday = [
      introduced('2026-10-14', { introduced_on: TODAY }),
      introduced('2026-10-14', { introduced_on: TODAY }),
    ]
    const queued = [makePhrase(), makePhrase(), makePhrase()]
    expect(dueToday([...doneToday, ...queued], TODAY, 3).fresh).toHaveLength(1)
  })

  it('releases no new phrases once today’s cap is used up', () => {
    const doneToday = Array.from({ length: 3 }, () =>
      introduced('2026-10-14', { introduced_on: TODAY }),
    )
    const queued = Array.from({ length: 20 }, () => makePhrase())
    expect(dueToday([...doneToday, ...queued], TODAY, 3).fresh).toEqual([])
  })

  it('releases nothing new with a cap of 0', () => {
    expect(dueToday([makePhrase()], TODAY, 0).fresh).toEqual([])
  })
})

describe('newAllowanceToday', () => {
  it('never goes negative when the cap was lowered after introducing more', () => {
    const doneToday = Array.from({ length: 5 }, () =>
      introduced('2026-10-14', { introduced_on: TODAY }),
    )
    expect(newAllowanceToday(doneToday, TODAY, 2)).toBe(0)
  })
})

describe('practiceSet', () => {
  it('picks introduced phrases not due today, soonest first, up to the size', () => {
    const soon = introduced('2026-10-14')
    const later = introduced('2026-10-20')
    const latest = introduced('2026-11-30')
    const dueNow = introduced('2026-10-13')
    const fresh = makePhrase()
    expect(practiceSet([latest, fresh, dueNow, later, soon], TODAY, 2).map((p) => p.id)).toEqual([
      soon.id,
      later.id,
    ])
  })

  it('defaults to 10 phrases', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      introduced(`2026-11-${String(i + 1).padStart(2, '0')}`),
    )
    expect(practiceSet(many, TODAY)).toHaveLength(10)
  })
})
