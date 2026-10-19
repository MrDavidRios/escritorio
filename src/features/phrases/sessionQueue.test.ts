import { describe, expect, it } from 'vitest'
import { afterResolved, buildSession, summarize } from './sessionQueue'
import { makePhrase } from './testPhrase'

const a = makePhrase()
const b = makePhrase()

describe('buildSession', () => {
  it('makes one first-pass item per phrase, in order', () => {
    expect(buildSession([a, b])).toEqual([
      { phrase: a, isRepeat: false },
      { phrase: b, isRepeat: false },
    ])
  })
})

describe('afterResolved', () => {
  it('re-queues a missed phrase once at the end of a review session', () => {
    const queue = buildSession([a, b])
    expect(afterResolved(queue, 0, 'again', 'review')).toEqual([
      { phrase: a, isRepeat: false },
      { phrase: b, isRepeat: false },
      { phrase: a, isRepeat: true },
    ])
  })

  it('does not re-queue a repeat that is missed again', () => {
    const queue = [...buildSession([a]), { phrase: a, isRepeat: true }]
    expect(afterResolved(queue, 1, 'again', 'review')).toBe(queue)
  })

  it('does not re-queue hard or good answers', () => {
    const queue = buildSession([a])
    expect(afterResolved(queue, 0, 'hard', 'review')).toBe(queue)
    expect(afterResolved(queue, 0, 'good', 'review')).toBe(queue)
  })

  it('does not re-queue in practice sessions', () => {
    const queue = buildSession([a])
    expect(afterResolved(queue, 0, 'again', 'practice')).toBe(queue)
  })
})

describe('summarize', () => {
  it('counts first-try successes, the rest, and the soonest next due date', () => {
    expect(
      summarize([
        { rating: 'good', nextDue: '2026-10-16' },
        { rating: 'hard', nextDue: '2026-10-14' },
        { rating: 'again', nextDue: '2026-10-14' },
        { rating: 'good', nextDue: '2026-10-20' },
      ]),
    ).toEqual({ firstTry: 2, neededMore: 2, nextDue: '2026-10-14' })
  })

  it('has no next due date for practice results', () => {
    expect(summarize([{ rating: 'good', nextDue: null }])).toEqual({
      firstTry: 1,
      neededMore: 0,
      nextDue: null,
    })
  })
})
