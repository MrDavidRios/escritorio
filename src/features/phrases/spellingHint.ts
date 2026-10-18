const LETTER = /[\p{L}\p{N}]/u

function letters(word: string): string[] {
  return [...word.normalize('NFC').toLowerCase()].filter((c) => LETTER.test(c))
}

/**
 * The expected answer with each misspelled word blanked from its first
 * wrong letter onward ("una hemorra___ de placer"). Words are matched by
 * position; case and punctuation are ignored when comparing, and an accent
 * counts as part of the letter. Punctuation from the expected form is kept.
 */
export function spellingHint(typed: string, expected: string): string {
  const typedWords = typed
    .split(/\s+/)
    .map(letters)
    .filter((w) => w.length > 0)

  let wordIndex = 0
  return expected
    .normalize('NFC')
    .split(/(\s+)/)
    .map((part) => {
      if (!LETTER.test(part)) return part
      const typedLetters = typedWords[wordIndex++] ?? []
      let matched = 0
      let wrong = false
      return [...part]
        .map((char) => {
          if (!LETTER.test(char)) return char
          if (!wrong && typedLetters[matched] === char.toLowerCase()) {
            matched++
            return char
          }
          wrong = true
          return '_'
        })
        .join('')
    })
    .join('')
}
