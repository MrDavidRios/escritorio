import { afterEach, describe, expect, it, vi } from 'vitest'
import { feedbackNote, gradePhrase, isMisspelling, ratingFor, type JevGrader } from './grading'

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
    ['minor_slip', false],
    ['valid_variant', true],
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

  it('treats a Jev "exact" as a misspelling, since an exact match never reaches Jev', async () => {
    const callJev = vi.fn<JevGrader>().mockResolvedValue({ verdict: 'exact', confidence: 0.9 })
    await expect(gradePhrase('meter la pada', phrase, callJev)).resolves.toEqual({
      correct: false,
      verdict: 'minor_slip',
      source: 'jev',
      jevVerdict: 'exact',
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
  it('is good when correct on the first try', () => {
    expect(ratingFor({ correct: true, attemptCount: 1 })).toBe('good')
  })

  it('is hard when it took a second or third try', () => {
    expect(ratingFor({ correct: true, attemptCount: 2 })).toBe('hard')
    expect(ratingFor({ correct: true, attemptCount: 3 })).toBe('hard')
  })

  it('is again when the answer was revealed', () => {
    expect(ratingFor({ correct: false, attemptCount: 3 })).toBe('again')
  })
})

describe('feedbackNote', () => {
  it('shows the exact form for an accepted variant', () => {
    const grade = {
      correct: true,
      verdict: 'valid_variant',
      source: 'jev',
      jevVerdict: 'valid_variant',
    } as const
    expect(feedbackNote(grade, 'meter la pata')).toBe('Accepted. Exact form: meter la pata')
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

describe('isMisspelling', () => {
  it('is true whenever Jev called it a minor slip, however sure it was', () => {
    expect(
      isMisspelling({
        correct: false,
        verdict: 'minor_slip',
        source: 'jev',
        jevVerdict: 'minor_slip',
      }),
    ).toBe(true)
    expect(
      isMisspelling({
        correct: false,
        verdict: 'wrong',
        source: 'fallback',
        jevVerdict: 'minor_slip',
      }),
    ).toBe(true)
  })

  it('is true when Jev called a non-matching answer exact', () => {
    expect(
      isMisspelling({ correct: false, verdict: 'wrong', source: 'fallback', jevVerdict: 'exact' }),
    ).toBe(true)
  })

  it('is false for other verdicts and when Jev never answered', () => {
    expect(
      isMisspelling({ correct: false, verdict: 'wrong', source: 'jev', jevVerdict: 'wrong' }),
    ).toBe(false)
    expect(
      isMisspelling({ correct: false, verdict: 'wrong', source: 'fallback', jevVerdict: null }),
    ).toBe(false)
  })
})
