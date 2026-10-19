import { describe, expect, it } from 'vitest'
import { isFlagOn, parseOverrides } from './flags'

describe('isFlagOn', () => {
  it('follows the database when there is no override', () => {
    expect(isFlagOn('phrases', new Set(['phrases']), {})).toBe(true)
    expect(isFlagOn('phrases', new Set(), {})).toBe(false)
  })

  it('lets an override win either way', () => {
    expect(isFlagOn('phrases', new Set(), { phrases: true })).toBe(true)
    expect(isFlagOn('phrases', new Set(['phrases']), { phrases: false })).toBe(false)
  })
})

describe('parseOverrides', () => {
  it('keeps boolean overrides for known flags', () => {
    expect(parseOverrides('{"phrases":true}')).toEqual({ phrases: true })
  })

  it('drops unknown flags and non-boolean values', () => {
    expect(parseOverrides('{"phrases":"yes","retired_flag":true}')).toEqual({})
  })

  it('treats missing or malformed storage as no overrides', () => {
    expect(parseOverrides(null)).toEqual({})
    expect(parseOverrides('not json')).toEqual({})
    expect(parseOverrides('[true]')).toEqual({})
  })
})
