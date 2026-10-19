import { describe, expect, it } from 'vitest'
import { phraseSchema } from './phraseSchema'

describe('phraseSchema', () => {
  it('requires Spanish and English, trimmed', () => {
    expect(phraseSchema.safeParse({ spanish: '  ', english: 'x', example: '' }).success).toBe(false)
    expect(phraseSchema.safeParse({ spanish: 'x', english: ' ', example: '' }).success).toBe(false)
    expect(
      phraseSchema.parse({ spanish: ' meter la pata ', english: ' to blunder ', example: '' }),
    ).toEqual({
      spanish: 'meter la pata',
      english: 'to blunder',
      example: '',
    })
  })

  it('caps lengths so a typed answer can always be stored', () => {
    expect(
      phraseSchema.safeParse({ spanish: 'x'.repeat(201), english: 'y', example: '' }).success,
    ).toBe(false)
    expect(
      phraseSchema.safeParse({ spanish: 'x', english: 'y'.repeat(301), example: '' }).success,
    ).toBe(false)
    expect(
      phraseSchema.safeParse({ spanish: 'x', english: 'y', example: 'z'.repeat(501) }).success,
    ).toBe(false)
  })
})
