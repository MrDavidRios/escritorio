// Pure request/response mapping for the grade-phrase function, kept apart
// from Deno.serve so it can be unit-tested. The verdict list mirrors
// JevVerdict in src/types/phrase.ts -- keep them in sync.

export const JEV_URL = 'https://api.typesafe.ai/v1/systemone'
export const JEV_MODEL = 'jev-latest'
export const MAX_FIELD_LENGTH = 500

export const VERDICTS = ['exact', 'minor_slip', 'valid_variant', 'wrong'] as const
export type Verdict = (typeof VERDICTS)[number]

export interface GradeRequest {
  english: string
  expected: string
  typed: string
}

export interface GradeResponse {
  verdict: Verdict
  confidence: number
}

function isField(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '' && value.length <= MAX_FIELD_LENGTH
}

export function parseGradeRequest(body: unknown): GradeRequest | null {
  if (typeof body !== 'object' || body === null) return null
  const { english, expected, typed } = body as Record<string, unknown>
  if (!isField(english) || !isField(expected) || !isField(typed)) return null
  return { english, expected, typed }
}

export function buildJevPayload(request: GradeRequest) {
  return {
    model: JEV_MODEL,
    state: {
      english_prompt: request.english,
      expected_spanish: request.expected,
      learner_typed: request.typed,
    },
    questions: {
      verdict: {
        type: 'choice' as const,
        instructions:
          'A Spanish learner saw english_prompt and typed the Spanish phrase from memory as ' +
          'learner_typed. The answer key is expected_spanish. How should learner_typed be graded?',
        criteria: {
          exact: {
            what: 'The same phrase as expected_spanish, ignoring capitalization, punctuation and spacing.',
            examples: ['expected "meter la pata", typed "Meter la pata."'],
          },
          minor_slip: {
            what:
              'The intended phrase with a small mechanical error: a missing or wrong accent, ' +
              'a one-letter typo, or a dropped or wrong article.',
            not_for: 'A different word, a wrong verb, or a change that alters the meaning.',
            examples: [
              'expected "llover a cántaros", typed "llover a cantaros"',
              'expected "meter la pata", typed "meter la pta"',
              'expected "echar una mano", typed "echar mano"',
            ],
          },
          valid_variant: {
            what:
              'Different wording that a native speaker would accept as the same idiom with the ' +
              'same meaning, such as a common regional variant.',
            not_for:
              'A literal word-for-word translation of the English that is not idiomatic Spanish, ' +
              'or a different idiom with a different meaning.',
            examples: ['expected "costar un ojo de la cara", typed "valer un ojo de la cara"'],
          },
          wrong: {
            what:
              'Anything else: a different phrase, a literal translation, missing key words, ' +
              'or unrelated text.',
            examples: [
              'expected "meter la pata", typed "poner el pie"',
              'expected "tomar el pelo", typed "tirar del pelo"',
            ],
          },
        },
      },
    },
  }
}

export function parseJevResponse(json: unknown): GradeResponse | null {
  const answer = (
    json as { answers?: { verdict?: { choice?: unknown; confidence?: unknown } } } | null
  )?.answers?.verdict
  if (!answer) return null
  const { choice, confidence } = answer
  if (!VERDICTS.includes(choice as Verdict) || typeof confidence !== 'number') return null
  return { verdict: choice as Verdict, confidence }
}
