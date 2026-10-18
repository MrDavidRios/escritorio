import { describe, expect, it } from 'vitest'
import { spellingHint } from './spellingHint'

describe('spellingHint', () => {
  it('blanks a word from its first wrong letter', () => {
    expect(spellingHint('una hemorrahggia de placer', 'una hemorragia de placer')).toBe(
      'una hemorra___ de placer',
    )
  })

  it('treats a missing or wrong accent as a wrong letter', () => {
    expect(spellingHint('llover a cantaros', 'llover a cántaros')).toBe('llover a c_______')
  })

  it('blanks letters the answer is missing', () => {
    expect(spellingHint('meter la pat', 'meter la pata')).toBe('meter la pat_')
  })

  it('ignores case and punctuation when comparing, but keeps the expected form', () => {
    expect(spellingHint('hola que tal', '¡Hola, qué tal!')).toBe('¡Hola, qu_ tal!')
  })

  it('blanks expected words the answer leaves out', () => {
    expect(spellingHint('meter la', 'meter la pata')).toBe('meter la ____')
  })

  it('shows everything when nothing is misspelled', () => {
    expect(spellingHint('Meter la pata.', 'meter la pata')).toBe('meter la pata')
  })
})
