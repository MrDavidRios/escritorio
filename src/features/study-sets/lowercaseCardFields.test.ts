import { describe, expect, it } from 'vitest'
import { lowercaseCardFields } from './lowercaseCardFields'

const card = { spanish_term: 'Día', english_equivalent: 'Day', definition: 'El Año' }

describe('lowercaseCardFields', () => {
  it('leaves cards alone when no fields are selected', () => {
    expect(lowercaseCardFields([card], [])).toEqual([card])
  })

  it('lowercases only the selected field, including accented capitals', () => {
    const accented = { ...card, spanish_term: 'ÁRBOL' }
    expect(lowercaseCardFields([accented], ['spanish_term'])).toEqual([
      { spanish_term: 'árbol', english_equivalent: 'Day', definition: 'El Año' },
    ])
  })

  it('lowercases every selected field', () => {
    const fields = ['spanish_term', 'english_equivalent', 'definition'] as const
    expect(lowercaseCardFields([card], fields)).toEqual([
      { spanish_term: 'día', english_equivalent: 'day', definition: 'el año' },
    ])
  })

  it('keeps empty fields null', () => {
    const blank = { spanish_term: 'A', english_equivalent: null, definition: 'B' }
    expect(lowercaseCardFields([blank], ['english_equivalent', 'definition'])).toEqual([
      { spanish_term: 'A', english_equivalent: null, definition: 'b' },
    ])
  })
})
