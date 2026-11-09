import type { ParsedCardRow } from './parseCardTable'

export type LowercaseField = 'spanish_term' | 'english_equivalent' | 'definition'

export function lowercaseCardFields(
  cards: ParsedCardRow[],
  fields: readonly LowercaseField[],
): ParsedCardRow[] {
  const lower = (field: LowercaseField, value: string | null) =>
    fields.includes(field) ? (value?.toLowerCase() ?? null) : value

  return cards.map((card) => ({
    spanish_term: fields.includes('spanish_term')
      ? card.spanish_term.toLowerCase()
      : card.spanish_term,
    english_equivalent: lower('english_equivalent', card.english_equivalent),
    definition: lower('definition', card.definition),
  }))
}
