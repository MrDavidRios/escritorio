import { describe, expect, it } from 'vitest'
import { isAnswerCorrect, normalizeAnswer } from './grading'

describe('normalizeAnswer', () => {
  it('lowercases and trims', () => {
    expect(normalizeAnswer('  Paris  ')).toBe('paris')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeAnswer('New   York')).toBe('new york')
  })

  it('strips punctuation', () => {
    expect(normalizeAnswer("don't")).toBe('dont')
    expect(normalizeAnswer('co-op')).toBe('coop')
    expect(normalizeAnswer('Hello, world!')).toBe('hello world')
  })

  it('handles empty input', () => {
    expect(normalizeAnswer('')).toBe('')
    expect(normalizeAnswer('   ')).toBe('')
  })
})

describe('isAnswerCorrect', () => {
  it('accepts an exact match', () => {
    expect(isAnswerCorrect('Paris', 'Paris')).toBe(true)
  })

  it('accepts case and whitespace differences', () => {
    expect(isAnswerCorrect('  paris ', 'Paris')).toBe(true)
  })

  it('accepts punctuation differences', () => {
    expect(isAnswerCorrect('dont', "don't")).toBe(true)
  })

  it('rejects a wrong answer', () => {
    expect(isAnswerCorrect('London', 'Paris')).toBe(false)
  })

  it('rejects empty input against a real answer', () => {
    expect(isAnswerCorrect('', 'Paris')).toBe(false)
  })
})
