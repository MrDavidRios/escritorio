export interface ParsedCardRow {
  spanish_term: string
  english_equivalent: string | null
  definition: string | null
}

export type MissingColumn = 'spanish' | 'content'

export interface ParsedCardTable {
  cards: ParsedCardRow[]
  skipped: number
  missingColumns: MissingColumn[]
}

type Column =
  'spanish' | 'english' | 'spanishDefinition' | 'unlabelledDefinition' | 'englishDefinition'
type ColumnIndexes = Partial<Record<Column, number>>

const includesAny = (text: string, words: string[]) => words.some((word) => text.includes(word))

const DEFINITION_WORDS = ['defin', 'significado', 'meaning']
const SPANISH_WORDS = ['espanol', 'spanish']
const ENGLISH_WORDS = ['ingles', 'english']

function classifyHeaderCell(cell: string): Column | null {
  const text = cell.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

  // Definitions come first because their names also contain language words.
  if (includesAny(text, DEFINITION_WORDS)) {
    if (includesAny(text, SPANISH_WORDS)) return 'spanishDefinition'
    if (includesAny(text, ENGLISH_WORDS)) return 'englishDefinition'
    return 'unlabelledDefinition'
  }
  if (includesAny(text, SPANISH_WORDS)) return 'spanish'
  if (includesAny(text, ENGLISH_WORDS)) return 'english'
  if (includesAny(text, ['palabra', 'termino', 'term', 'word'])) return 'spanish'
  if (includesAny(text, ['equivalent', 'traduccion', 'translation'])) return 'english'
  return null
}

function splitLine(line: string, tabDelimited: boolean): string[] {
  // Only trim the line in space mode: a leading tab marks an empty first cell.
  const cells = tabDelimited ? line.split('\t') : line.trim().split(/\s{2,}/)
  return cells.map((cell) => cell.trim())
}

function indexColumns(cells: string[]): ColumnIndexes {
  const indexes: ColumnIndexes = {}
  cells.forEach((cell, index) => {
    const column = classifyHeaderCell(cell)
    if (column && indexes[column] === undefined) indexes[column] = index
  })
  return indexes
}

function findMissingColumns(indexes: ColumnIndexes): MissingColumn[] {
  const missing: MissingColumn[] = []
  if (indexes.spanish === undefined) missing.push('spanish')
  const hasContent =
    indexes.english !== undefined ||
    indexes.spanishDefinition !== undefined ||
    indexes.unlabelledDefinition !== undefined ||
    indexes.englishDefinition !== undefined
  if (!hasContent) missing.push('content')
  return missing
}

function buildRow(cells: string[], indexes: ColumnIndexes): ParsedCardRow | null {
  const read = (column: Column) => {
    const index = indexes[column]
    return index === undefined ? null : cells[index] || null
  }
  const spanish_term = read('spanish')
  const english_equivalent = read('english')
  const definition =
    read('spanishDefinition') ?? read('unlabelledDefinition') ?? read('englishDefinition')
  if (!spanish_term || (!english_equivalent && !definition)) return null
  return { spanish_term, english_equivalent, definition }
}

/** Turns pasted plain text into card rows, using its header row to identify the columns. */
export function parseCardTable(text: string): ParsedCardTable {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return { cards: [], skipped: 0, missingColumns: [] }

  const headerIndex = lines.findIndex(
    (line) => findMissingColumns(indexColumns(splitLine(line, line.includes('\t')))).length === 0,
  )
  if (headerIndex === -1) {
    const firstCells = splitLine(lines[0], lines[0].includes('\t'))
    return { cards: [], skipped: 0, missingColumns: findMissingColumns(indexColumns(firstCells)) }
  }

  const headerLine = lines[headerIndex]
  const tabDelimited = headerLine.includes('\t')
  const headerCells = splitLine(headerLine, tabDelimited)
  const indexes = indexColumns(headerCells)

  const cards: ParsedCardRow[] = []
  let skipped = 0
  for (const line of lines.slice(headerIndex + 1)) {
    if (line.trim() === headerLine.trim()) continue
    const cells = splitLine(line, tabDelimited)
    // Without tabs, a missing cell can't be located, so the row can't be trusted.
    const row =
      !tabDelimited && cells.length !== headerCells.length ? null : buildRow(cells, indexes)
    if (row) cards.push(row)
    else skipped++
  }
  return { cards, skipped, missingColumns: [] }
}
