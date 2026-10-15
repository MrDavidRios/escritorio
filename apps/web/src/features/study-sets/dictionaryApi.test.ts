import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchEnglishDefinition, fetchSpanishDefinition } from './dictionaryApi'

afterEach(() => {
  vi.unstubAllGlobals()
})

function mockFetch(response: Partial<Response> & { json?: () => unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => undefined,
    ...response,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('fetchEnglishDefinition', () => {
  it('returns the first definition of the first sense', async () => {
    mockFetch({
      json: async () => ({
        entries: [{ senses: [{ definition: 'a domesticated canine' }, { definition: 'other' }] }],
      }),
    })
    expect(await fetchEnglishDefinition('perro')).toBe('a domesticated canine')
  })

  it('encodes the word in the request URL', async () => {
    const fetchMock = mockFetch({ json: async () => ({ entries: [] }) })
    await fetchEnglishDefinition('ñoño')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://freedictionaryapi.com/api/v1/entries/es/%C3%B1o%C3%B1o',
    )
  })

  it('returns null for blank input without calling fetch', async () => {
    const fetchMock = mockFetch({ json: async () => ({ entries: [] }) })
    expect(await fetchEnglishDefinition('   ')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null on a non-ok response', async () => {
    mockFetch({ ok: false })
    expect(await fetchEnglishDefinition('asdfghjkl')).toBeNull()
  })

  it('returns null when no entries have a definition', async () => {
    mockFetch({ json: async () => ({ entries: [{ senses: [] }] }) })
    expect(await fetchEnglishDefinition('perro')).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    expect(await fetchEnglishDefinition('perro')).toBeNull()
  })
})

describe('fetchSpanishDefinition', () => {
  it('returns the first description of the first sense', async () => {
    mockFetch({
      json: async () => ({
        data: {
          meanings: [
            { senses: [{ description: 'perro cánido doméstico' }, { description: 'otro' }] },
          ],
        },
      }),
    })
    expect(await fetchSpanishDefinition('perro')).toBe('perro cánido doméstico')
  })

  it('encodes the word in the request URL', async () => {
    const fetchMock = mockFetch({ json: async () => ({ data: { meanings: [] } }) })
    await fetchSpanishDefinition('ñoño')
    expect(fetchMock).toHaveBeenCalledWith('https://rae-api.com/api/words/%C3%B1o%C3%B1o')
  })

  it('returns null for blank input without calling fetch', async () => {
    const fetchMock = mockFetch({ json: async () => ({ data: { meanings: [] } }) })
    expect(await fetchSpanishDefinition('   ')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null on a non-ok response', async () => {
    mockFetch({ ok: false })
    expect(await fetchSpanishDefinition('asdfghjkl')).toBeNull()
  })

  it('returns null when no meanings have a description', async () => {
    mockFetch({ json: async () => ({ data: { meanings: [{ senses: [] }] } }) })
    expect(await fetchSpanishDefinition('perro')).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    expect(await fetchSpanishDefinition('perro')).toBeNull()
  })
})
