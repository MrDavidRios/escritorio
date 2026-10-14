import { afterEach, describe, expect, it, vi } from 'vitest'
import { feedbackNote, gradePhrase, ratingFor, type JevGrader } from './grading'

const phrase = { english: "to put one's foot in it", spanish: 'meter la pata' }

afterEach(() => {
  vi.useRealTimers()
})

describe('gradePhrase', () => {
  it('accepts an exact match without calling Jev', async () => {
    const callJev = vi.fn<JevGrader>()
    await expect(gradePhrase('  Meter la pata! ', phrase, callJev)).resolves.toEqual({
      correct: true,
      verdict: 'exact',
      source: 'exact',
      jevVerdict: null,
    })
    expect(callJev).not.toHaveBeenCalled()
  })

  it('grades a blank answer wrong without calling Jev', async () => {
    const callJev = vi.fn<JevGrader>()
    await expect(gradePhrase('   ', phrase, callJev)).resolves.toEqual({
      correct: false,
      verdict: 'wrong',
      source: 'exact',
      jevVerdict: null,
    })
    expect(callJev).not.toHaveBeenCalled()
  })

  it('sends the English prompt, expected Spanish, and typed answer to Jev', async () => {
    const callJev = vi.fn<JevGrader>().mockResolvedValue({ verdict: 'wrong', confidence: 0.9 })
    await gradePhrase('meter el pie', phrase, callJev)
    expect(callJev).toHaveBeenCalledWith(
      { english: phrase.english, expected: 'meter la pata', typed: 'meter el pie' },
      expect.any(AbortSignal),
    )
  })

  it.each([
    ['minor_slip', true],
    ['valid_variant', true],
    ['exact', true],
    ['wrong', false],
  ] as const)('uses a confident Jev verdict %s (correct: %s)', async (verdict, correct) => {
    const callJev = vi.fn<JevGrader>().mockResolvedValue({ verdict, confidence: 0.9 })
    await expect(gradePhrase('meter la pta', phrase, callJev)).resolves.toEqual({
      correct,
      verdict,
      source: 'jev',
      jevVerdict: verdict,
    })
  })

  it('falls back to strict when Jev is unsure, keeping what Jev said', async () => {
    const callJev = vi.fn<JevGrader>().mockResolvedValue({ verdict: 'minor_slip', confidence: 0.4 })
    await expect(gradePhrase('meter la pta', phrase, callJev)).resolves.toEqual({
      correct: false,
      verdict: 'wrong',
      source: 'fallback',
      jevVerdict: 'minor_slip',
    })
  })

  it('falls back to strict when the Jev call fails', async () => {
    const callJev = vi.fn<JevGrader>().mockRejectedValue(new Error('502'))
    await expect(gradePhrase('meter la pta', phrase, callJev)).resolves.toEqual({
      correct: false,
      verdict: 'wrong',
      source: 'fallback',
      jevVerdict: null,
    })
  })

  it('falls back when the grader throws synchronously, leaving no timer behind', async () => {
    vi.useFakeTimers()
    const callJev: JevGrader = () => {
      throw new Error('boom')
    }
    await expect(gradePhrase('meter la pta', phrase, callJev)).resolves.toEqual({
      correct: false,
      verdict: 'wrong',
      source: 'fallback',
      jevVerdict: null,
    })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('falls back at the timeout instead of waiting forever, and aborts the call', async () => {
    vi.useFakeTimers()
    let seenSignal: AbortSignal | undefined
    const callJev: JevGrader = (_request, signal) => {
      seenSignal = signal
      return new Promise(() => {})
    }
    const pending = gradePhrase('meter la pta', phrase, callJev, 4000)
    await vi.advanceTimersByTimeAsync(4000)
    await expect(pending).resolves.toMatchObject({ correct: false, source: 'fallback' })
    expect(seenSignal?.aborted).toBe(true)
  })
})

describe('ratingFor', () => {
  it('is good for a first-try exact or valid variant', () => {
    expect(ratingFor({ correct: true, attemptCount: 1, verdict: 'exact' })).toBe('good')
    expect(ratingFor({ correct: true, attemptCount: 1, verdict: 'valid_variant' })).toBe('good')
  })

  it('is hard for a minor slip, even on the first try', () => {
    expect(ratingFor({ correct: true, attemptCount: 1, verdict: 'minor_slip' })).toBe('hard')
  })

  it('is hard when it took a second or third try', () => {
    expect(ratingFor({ correct: true, attemptCount: 2, verdict: 'exact' })).toBe('hard')
    expect(ratingFor({ correct: true, attemptCount: 3, verdict: 'exact' })).toBe('hard')
  })

  it('is again when the answer was revealed', () => {
    expect(ratingFor({ correct: false, attemptCount: 3, verdict: 'wrong' })).toBe('again')
  })
})

describe('feedbackNote', () => {
  it('shows the exact form for slips and variants', () => {
    const grade = {
      correct: true,
      verdict: 'minor_slip',
      source: 'jev',
      jevVerdict: 'minor_slip',
    } as const
    expect(feedbackNote(grade, 'meter la pata')).toBe('Accepted. Exact form: meter la pata')
    expect(feedbackNote({ ...grade, verdict: 'valid_variant' }, 'meter la pata')).toBe(
      'Accepted. Exact form: meter la pata',
    )
  })

  it('has no note for an exact answer or a wrong one', () => {
    expect(
      feedbackNote({ correct: true, verdict: 'exact', source: 'exact', jevVerdict: null }, 'x'),
    ).toBeNull()
    expect(
      feedbackNote({ correct: false, verdict: 'wrong', source: 'jev', jevVerdict: 'wrong' }, 'x'),
    ).toBeNull()
  })
})
