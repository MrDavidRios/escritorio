import { describe, expect, it } from 'vitest'
import { hasRequiredContent } from './cardSchema'

describe('hasRequiredContent', () => {
  const empty = { hasImage: false, definition: '', englishEquivalent: '' }

  it('rejects a card with no image, definition, or English equivalent', () => {
    expect(hasRequiredContent(empty)).toBe(false)
    expect(hasRequiredContent({ hasImage: false, definition: null, englishEquivalent: null })).toBe(
      false,
    )
  })

  it('treats whitespace-only text as empty', () => {
    expect(hasRequiredContent({ ...empty, definition: '  ', englishEquivalent: '\n' })).toBe(false)
  })

  it('accepts an image alone', () => {
    expect(hasRequiredContent({ ...empty, hasImage: true })).toBe(true)
  })

  it('accepts a definition alone', () => {
    expect(hasRequiredContent({ ...empty, definition: 'a small house' })).toBe(true)
  })

  it('accepts an English equivalent alone', () => {
    expect(hasRequiredContent({ ...empty, englishEquivalent: 'cabin' })).toBe(true)
  })
})
