import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSignedUrlBatcher } from './signedUrlBatcher'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createSignedUrlBatcher', () => {
  it('signs every path requested in the same tick with one call', async () => {
    const sign = vi.fn(async (paths: string[]) =>
      Object.fromEntries(paths.map((p) => [p, `signed:${p}`])),
    )
    const getSignedUrl = createSignedUrlBatcher(sign)

    const results = Promise.all([getSignedUrl('a.webp'), getSignedUrl('b.webp')])
    await vi.runAllTimersAsync()

    expect(await results).toEqual(['signed:a.webp', 'signed:b.webp'])
    expect(sign).toHaveBeenCalledTimes(1)
    expect(sign).toHaveBeenCalledWith(['a.webp', 'b.webp'])
  })

  it('dedupes a path requested twice in one tick', async () => {
    const sign = vi.fn(async (paths: string[]) =>
      Object.fromEntries(paths.map((p) => [p, `signed:${p}`])),
    )
    const getSignedUrl = createSignedUrlBatcher(sign)

    const results = Promise.all([getSignedUrl('a.webp'), getSignedUrl('a.webp')])
    await vi.runAllTimersAsync()

    expect(await results).toEqual(['signed:a.webp', 'signed:a.webp'])
    expect(sign).toHaveBeenCalledWith(['a.webp'])
  })

  it('resolves a path with no URL to null without affecting the others', async () => {
    const getSignedUrl = createSignedUrlBatcher(async () => ({ 'a.webp': 'signed:a.webp' }))

    const results = Promise.all([getSignedUrl('a.webp'), getSignedUrl('missing.webp')])
    await vi.runAllTimersAsync()

    expect(await results).toEqual(['signed:a.webp', null])
  })

  it('makes a separate call for requests in a later tick', async () => {
    const sign = vi.fn(async (paths: string[]) =>
      Object.fromEntries(paths.map((p) => [p, `signed:${p}`])),
    )
    const getSignedUrl = createSignedUrlBatcher(sign)

    const first = getSignedUrl('a.webp')
    await vi.runAllTimersAsync()
    await first
    const second = getSignedUrl('b.webp')
    await vi.runAllTimersAsync()
    await second

    expect(sign).toHaveBeenCalledTimes(2)
  })

  it('rejects every waiter when the batch fails', async () => {
    const getSignedUrl = createSignedUrlBatcher(async () => {
      throw new Error('boom')
    })

    const results = Promise.allSettled([getSignedUrl('a.webp'), getSignedUrl('b.webp')])
    await vi.runAllTimersAsync()

    const settled = await results
    expect(settled.map((r) => r.status)).toEqual(['rejected', 'rejected'])
  })
})
