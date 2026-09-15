/**
 * Normalizes an answer string for forgiving comparison: case-insensitive,
 * trimmed, whitespace-collapsed, and punctuation-stripped. This is
 * deliberately not fuzzy/edit-distance matching — see isAnswerCorrect.
 */
export function normalizeAnswer(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Compares a user's typed answer against the correct answer, forgivingly. */
export function isAnswerCorrect(userInput: string, correctAnswer: string): boolean {
  return normalizeAnswer(userInput) === normalizeAnswer(correctAnswer)
}
