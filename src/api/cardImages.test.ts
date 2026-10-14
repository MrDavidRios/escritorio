import { describe, expect, it, vi } from 'vitest'
import { cardImagePath, phraseImagePath } from './cardImages'

// Hoisted above the import: the real client throws without VITE_SUPABASE_* env.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

describe('image paths', () => {
  it('keeps card images at the owner root', () => {
    expect(cardImagePath('owner', 'card', 'photo.JPG')).toBe('owner/card.jpg')
  })

  it('puts phrase images in a phrases/ folder under the owner', () => {
    expect(phraseImagePath('owner', 'phrase', 'photo.webp')).toBe('owner/phrases/phrase.webp')
  })
})
