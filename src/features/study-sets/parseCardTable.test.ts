import { describe, expect, it } from 'vitest'
import { parseCardTable } from './parseCardTable'

const tsv = (...rows: string[][]) => rows.map((row) => row.join('\t')).join('\n')
const FULL = ['Español', 'English', 'Definición simple (español)', 'Simple definition (English)']

describe('parseCardTable', () => {
  it('returns nothing for empty input', () => {
    expect(parseCardTable('  \n ')).toEqual({ cards: [], skipped: 0, missingColumns: [] })
  })

  it('reads all four columns, keeping only the Spanish definition', () => {
    expect(parseCardTable(tsv(FULL, ['Altar', 'Altar', 'Una mesa', 'A table'])).cards).toEqual([
      { spanish_term: 'Altar', english_equivalent: 'Altar', definition: 'Una mesa' },
    ])
  })

  it.each([
    [['Spanish word', 'English equivalent'], ['casa', 'house'], 'house', null],
    [['English equivalent', 'Spanish word'], ['house', 'casa'], 'house', null],
    [['Definition in Spanish', 'Spanish word'], ['un hogar', 'casa'], null, 'un hogar'],
    [['Spanish word', 'Definition in English'], ['casa', 'a home'], null, 'a home'],
    [['English word', 'Palabra'], ['house', 'casa'], 'house', null],
  ])('handles columns %j', (header, row, english_equivalent, definition) => {
    expect(parseCardTable(tsv(header, row)).cards).toEqual([
      { spanish_term: 'casa', english_equivalent, definition },
    ])
  })

  it('falls back per row: Spanish, then unlabelled, then English definition', () => {
    const header = ['Spanish', 'Definición (español)', 'Definition', 'Definition (English)']
    const { cards } = parseCardTable(
      tsv(header, ['a', 'es', 'bare', 'en'], ['b', '', 'bare', 'en'], ['c', '', '', 'en']),
    )
    expect(cards.map((c) => c.definition)).toEqual(['es', 'bare', 'en'])
  })

  it('splits on runs of two or more spaces and handles Windows line endings', () => {
    const text = 'Spanish    English\r\nDía de Muertos    Day of the Dead\r\n'
    expect(parseCardTable(text).cards).toEqual([
      { spanish_term: 'Día de Muertos', english_equivalent: 'Day of the Dead', definition: null },
    ])
  })

  it('keeps cell text as written and keeps duplicates', () => {
    const { cards } = parseCardTable(tsv(['Spanish', 'English'], ['a', 'x / y'], ['a', 'x / y']))
    expect(cards).toHaveLength(2)
    expect(cards[0].english_equivalent).toBe('x / y')
  })

  it('skips and counts rows without required content, turning empty cells into null', () => {
    const header = ['Spanish', 'English', 'Definition']
    const result = parseCardTable(tsv(header, ['', 'x', 'y'], ['b', '', ''], ['c', 'z', '']))
    expect(result.skipped).toBe(2)
    expect(result.cards).toEqual([{ spanish_term: 'c', english_equivalent: 'z', definition: null }])
  })

  it('skips space-delimited rows with the wrong number of cells', () => {
    const result = parseCardTable('Spanish  English  Definition\na  b\nc  d  e')
    expect(result.skipped).toBe(1)
    expect(result.cards).toHaveLength(1)
  })

  it('reports each kind of missing column', () => {
    expect(parseCardTable('English\tDefinition\nx\ty').missingColumns).toEqual(['spanish'])
    expect(parseCardTable('Spanish\tNotes\nx\ty').missingColumns).toEqual(['content'])
    expect(parseCardTable('casa\thouse').missingColumns).toEqual(['spanish', 'content'])
  })

  it('handles a table shaped like the sample, with sections and repeated headers', () => {
    const header = FULL.join('    ')
    const section = (name: string, size: number) => [
      name,
      header,
      ...Array.from({ length: size }, (_, i) => `${name} ${i}    w    es def    en def`),
    ]
    const text = [...section('Parte 1', 28), ...section('Parte 2', 27), ...section('Parte 3', 16)]
    const result = parseCardTable(text.join('\n'))
    expect(result.cards).toHaveLength(71)
    expect(result.skipped).toBe(2)
    expect(result.cards[0].definition).toBe('es def')
  })

  it('does not shift columns for an indented space-delimited line', () => {
    expect(parseCardTable('Spanish  English\n   a  b').cards[0]).toMatchObject({
      spanish_term: 'a',
      english_equivalent: 'b',
    })
  })

  it('parses non-breaking spaces and a leading byte-order mark', () => {
    expect(parseCardTable('﻿Spanish  English\na  b').cards).toEqual([
      { spanish_term: 'a', english_equivalent: 'b', definition: null },
    ])
  })

  it('returns no cards and no problems for a header-only paste', () => {
    expect(parseCardTable('Spanish\tEnglish')).toEqual({
      cards: [],
      skipped: 0,
      missingColumns: [],
    })
  })
})
