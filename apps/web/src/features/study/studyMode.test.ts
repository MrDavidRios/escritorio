import { describe, expect, it } from 'vitest'
import type { Card } from '@/types/card'
import { buildQuestion, eligibleCards, exclusionReason, isCardEligible } from './studyMode'

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    study_set_id: 'set-1',
    owner_id: 'owner-1',
    image_path: null,
    spanish_term: 'perro',
    english_equivalent: null,
    definition: null,
    hint: null,
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('isCardEligible / conversion', () => {
  it('requires a non-empty english_equivalent', () => {
    const withEnglish = makeCard({ english_equivalent: 'dog' })
    const withoutEnglish = makeCard({ english_equivalent: null })
    const config = { mode: 'conversion' as const, direction: 'en_es' as const }
    expect(isCardEligible(withEnglish, config)).toBe(true)
    expect(isCardEligible(withoutEnglish, config)).toBe(false)
  })

  it('is eligible regardless of which direction is configured', () => {
    const card = makeCard({ english_equivalent: 'dog' })
    expect(isCardEligible(card, { mode: 'conversion', direction: 'es_en' })).toBe(true)
    expect(isCardEligible(card, { mode: 'conversion', direction: 'random' })).toBe(true)
  })
})

describe('isCardEligible / meaning', () => {
  const imageOnly = makeCard({ image_path: 'img.jpg', definition: null })
  const definitionOnly = makeCard({ image_path: null, definition: 'a small animal' })
  const both = makeCard({ image_path: 'img.jpg', definition: 'a small animal' })
  const neither = makeCard({ image_path: null, definition: null })

  it("'image' visibility requires image_path", () => {
    const config = { mode: 'meaning' as const, visibility: 'image' as const }
    expect(isCardEligible(imageOnly, config)).toBe(true)
    expect(isCardEligible(definitionOnly, config)).toBe(false)
  })

  it("'definition' visibility requires definition", () => {
    const config = { mode: 'meaning' as const, visibility: 'definition' as const }
    expect(isCardEligible(definitionOnly, config)).toBe(true)
    expect(isCardEligible(imageOnly, config)).toBe(false)
  })

  it("'both' visibility strictly requires both fields (narrowest deck)", () => {
    const config = { mode: 'meaning' as const, visibility: 'both' as const }
    expect(isCardEligible(both, config)).toBe(true)
    expect(isCardEligible(imageOnly, config)).toBe(false)
    expect(isCardEligible(definitionOnly, config)).toBe(false)
    expect(isCardEligible(neither, config)).toBe(false)
  })
})

describe('eligibleCards', () => {
  it('filters out ineligible cards, preserving order', () => {
    const cards = [
      makeCard({ id: 'a', english_equivalent: 'dog' }),
      makeCard({ id: 'b', english_equivalent: null }),
      makeCard({ id: 'c', english_equivalent: 'cat' }),
    ]
    const result = eligibleCards(cards, { mode: 'conversion', direction: 'en_es' })
    expect(result.map((c) => c.id)).toEqual(['a', 'c'])
  })

  it('can return an empty deck when no cards qualify', () => {
    const cards = [
      makeCard({ image_path: 'img.jpg', definition: null }),
      makeCard({ image_path: null, definition: 'def' }),
    ]
    const result = eligibleCards(cards, { mode: 'meaning', visibility: 'both' })
    expect(result).toEqual([])
  })
})

describe('exclusionReason', () => {
  it('returns null for an eligible card', () => {
    const card = makeCard({ english_equivalent: 'dog' })
    expect(exclusionReason(card, { mode: 'conversion', direction: 'en_es' })).toBeNull()
  })

  it('names the missing field for conversion mode', () => {
    const card = makeCard({ english_equivalent: null })
    expect(exclusionReason(card, { mode: 'conversion', direction: 'en_es' })).toBe(
      'No English equivalent',
    )
  })

  it('names the missing field(s) for meaning mode', () => {
    const imageOnly = makeCard({ image_path: 'img.jpg', definition: null })
    const definitionOnly = makeCard({ image_path: null, definition: 'def' })
    const neither = makeCard({ image_path: null, definition: null })
    expect(exclusionReason(imageOnly, { mode: 'meaning', visibility: 'definition' })).toBe(
      'No definition',
    )
    expect(exclusionReason(definitionOnly, { mode: 'meaning', visibility: 'image' })).toBe(
      'No image',
    )
    expect(exclusionReason(imageOnly, { mode: 'meaning', visibility: 'both' })).toBe(
      'No definition',
    )
    expect(exclusionReason(neither, { mode: 'meaning', visibility: 'both' })).toBe(
      'No image or definition',
    )
  })
})

describe('buildQuestion / conversion', () => {
  const card = makeCard({ spanish_term: 'perro', english_equivalent: 'dog' })

  it('en_es: prompts with English, expects Spanish', () => {
    const q = buildQuestion(card, { mode: 'conversion', direction: 'en_es' })
    expect(q.prompt).toBe('dog')
    expect(q.expectedAnswer).toBe('perro')
    expect(q.answerLanguage).toBe('es')
    expect(q.resolvedDirection).toBe('en_es')
  })

  it('es_en: prompts with Spanish, expects English', () => {
    const q = buildQuestion(card, { mode: 'conversion', direction: 'es_en' })
    expect(q.prompt).toBe('perro')
    expect(q.expectedAnswer).toBe('dog')
    expect(q.answerLanguage).toBe('en')
    expect(q.resolvedDirection).toBe('es_en')
  })

  it("random: resolves to en_es when rng() < 0.5", () => {
    const q = buildQuestion(card, { mode: 'conversion', direction: 'random' }, () => 0.1)
    expect(q.resolvedDirection).toBe('en_es')
    expect(q.prompt).toBe('dog')
  })

  it("random: resolves to es_en when rng() >= 0.5", () => {
    const q = buildQuestion(card, { mode: 'conversion', direction: 'random' }, () => 0.9)
    expect(q.resolvedDirection).toBe('es_en')
    expect(q.prompt).toBe('perro')
  })
})

describe('buildQuestion / meaning', () => {
  const card = makeCard({
    spanish_term: 'perro',
    image_path: 'img.jpg',
    definition: 'a small animal',
  })

  it('always expects the Spanish term, in Spanish', () => {
    const q = buildQuestion(card, { mode: 'meaning', visibility: 'both' })
    expect(q.expectedAnswer).toBe('perro')
    expect(q.answerLanguage).toBe('es')
    expect(q.resolvedDirection).toBeNull()
  })

  it("'image' visibility shows only the image", () => {
    const q = buildQuestion(card, { mode: 'meaning', visibility: 'image' })
    expect(q.showImage).toBe(true)
    expect(q.showDefinition).toBe(false)
  })

  it("'definition' visibility shows only the definition", () => {
    const q = buildQuestion(card, { mode: 'meaning', visibility: 'definition' })
    expect(q.showImage).toBe(false)
    expect(q.showDefinition).toBe(true)
  })

  it("'both' visibility shows both", () => {
    const q = buildQuestion(card, { mode: 'meaning', visibility: 'both' })
    expect(q.showImage).toBe(true)
    expect(q.showDefinition).toBe(true)
  })
})
