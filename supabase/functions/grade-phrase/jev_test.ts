import { assertEquals } from 'jsr:@std/assert@1'
import { buildJevPayload, parseGradeRequest, parseJevResponse } from './jev.ts'

Deno.test('parseGradeRequest accepts three non-empty strings', () => {
  assertEquals(
    parseGradeRequest({ english: 'to blunder', expected: 'meter la pata', typed: 'meter la pta' }),
    {
      english: 'to blunder',
      expected: 'meter la pata',
      typed: 'meter la pta',
    },
  )
})

Deno.test('parseGradeRequest rejects missing, blank, non-string, or oversized fields', () => {
  assertEquals(parseGradeRequest(null), null)
  assertEquals(parseGradeRequest({ english: 'a', expected: 'b' }), null)
  assertEquals(parseGradeRequest({ english: 'a', expected: 'b', typed: '  ' }), null)
  assertEquals(parseGradeRequest({ english: 'a', expected: 2, typed: 'c' }), null)
  assertEquals(parseGradeRequest({ english: 'a', expected: 'b', typed: 'x'.repeat(501) }), null)
})

Deno.test('buildJevPayload asks one choice question over the four verdicts', () => {
  const payload = buildJevPayload({
    english: 'to blunder',
    expected: 'meter la pata',
    typed: 'meter la pta',
  })
  assertEquals(payload.model, 'jev-latest')
  assertEquals(payload.state, {
    english_prompt: 'to blunder',
    expected_spanish: 'meter la pata',
    learner_typed: 'meter la pta',
  })
  assertEquals(payload.questions.verdict.type, 'choice')
  assertEquals(Object.keys(payload.questions.verdict.criteria), [
    'exact',
    'minor_slip',
    'valid_variant',
    'wrong',
  ])
})

Deno.test('parseJevResponse reads the verdict answer', () => {
  assertEquals(
    parseJevResponse({
      model: 'jev-1.13',
      answers: {
        verdict: { type: 'choice', choice: 'minor_slip', probabilities: {}, confidence: 0.82 },
      },
    }),
    { verdict: 'minor_slip', confidence: 0.82 },
  )
})

Deno.test('parseJevResponse rejects unknown choices or malformed bodies', () => {
  assertEquals(
    parseJevResponse({ answers: { verdict: { choice: 'maybe', confidence: 0.9 } } }),
    null,
  )
  assertEquals(parseJevResponse({ answers: { verdict: { choice: 'exact' } } }), null)
  assertEquals(parseJevResponse({}), null)
  assertEquals(parseJevResponse(null), null)
})
