import { describe, expect, it } from 'vitest'
import {
  applyGrade,
  INITIAL_ANSWER_STATE,
  isLocked,
  MAX_ATTEMPTS,
  type GradeOutcome,
  type Resolution,
} from './typedAnswerState'

const right = { correct: true }
const wrong = { correct: false }

describe('applyGrade', () => {
  it('resolves correct on the first try', () => {
    const { state, resolution } = applyGrade(INITIAL_ANSWER_STATE, 'hola', right)
    expect(state.feedback).toEqual({ kind: 'correct', note: null })
    expect(isLocked(state)).toBe(true)
    expect(resolution).toEqual({ correct: true, attemptCount: 1, typed: 'hola', outcome: right })
  })

  it('carries the outcome note into the correct feedback', () => {
    const outcome = { correct: true, note: 'Accepted. Exact form: hola' }
    expect(applyGrade(INITIAL_ANSWER_STATE, 'ola', outcome).state.feedback).toEqual({
      kind: 'correct',
      note: 'Accepted. Exact form: hola',
    })
  })

  it('asks for a retry with the attempts left, without resolving', () => {
    const { state, resolution } = applyGrade(INITIAL_ANSWER_STATE, 'x', wrong)
    expect(state).toEqual({
      attempts: 1,
      feedback: { kind: 'retry', attemptsLeft: MAX_ATTEMPTS - 1 },
    })
    expect(isLocked(state)).toBe(false)
    expect(resolution).toBeNull()
  })

  it('reveals after the third miss and resolves incorrect', () => {
    let state = INITIAL_ANSWER_STATE
    let resolution: Resolution<GradeOutcome> | null = null
    for (const typed of ['a', 'b', 'c']) {
      ;({ state, resolution } = applyGrade(state, typed, wrong))
    }
    expect(state.feedback).toEqual({ kind: 'revealed' })
    expect(isLocked(state)).toBe(true)
    expect(resolution).toEqual({ correct: false, attemptCount: 3, typed: 'c', outcome: wrong })
  })

  it('counts the attempt a late correct answer landed on', () => {
    const afterMiss = applyGrade(INITIAL_ANSWER_STATE, 'x', wrong).state
    expect(applyGrade(afterMiss, 'hola', right).resolution?.attemptCount).toBe(2)
  })
})
