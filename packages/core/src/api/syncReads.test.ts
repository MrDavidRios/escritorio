import { describe, expect, it } from 'vitest'
import { createApi } from './index'
import { fakeSupabase } from './testing/fakeSupabase'

const card = (n: number) => ({ id: `c${n}`, study_set_id: 's1', position: n })

describe('listAllCards', () => {
  it('pages through every card the user owns, in set and position order', async () => {
    const { client, requests } = fakeSupabase((request) => {
      const offset = Number(request.url.searchParams.get('offset') ?? 0)
      return { body: offset === 0 ? Array.from({ length: 1000 }, (_, i) => card(i)) : [card(1000)] }
    })

    const cards = await createApi(client).cards.listAllCards()

    expect(cards).toHaveLength(1001)
    expect(requests).toHaveLength(2)
    expect(requests[0].url.pathname).toBe('/rest/v1/cards')
    expect(requests[0].url.searchParams.get('study_set_id')).toBeNull()
    expect(requests[0].url.searchParams.get('order')).toBe('study_set_id.asc,position.asc,id.asc')
    expect(requests.map((r) => r.url.searchParams.get('offset'))).toEqual(['0', '1000'])
    expect(requests[0].url.searchParams.get('limit')).toBe('1000')
  })

  it('stops after one request when the first page is short', async () => {
    const { client, requests } = fakeSupabase(() => ({ body: [card(0)] }))
    expect(await createApi(client).cards.listAllCards()).toEqual([card(0)])
    expect(requests).toHaveLength(1)
  })
})

describe('listImageVersions', () => {
  const file = (name: string, updated_at: string) => ({ name, id: `id-${name}`, updated_at })

  it('maps every card and set image path to its updated_at, paging each folder', async () => {
    const { client, requests } = fakeSupabase((request) => {
      const { prefix, offset } = request.body as { prefix: string; offset: number }
      if (prefix === 'u1/sets') return { body: [file('s1.png', '2026-10-02T00:00:00Z')] }
      if (offset === 0) {
        return {
          body: Array.from({ length: 100 }, (_, i) => file(`c${i}.png`, '2026-10-01T00:00:00Z')),
        }
      }
      // Last page of the owner folder, with the `sets` sub-folder entry.
      return {
        body: [
          file('c100.png', '2026-10-03T00:00:00Z'),
          { name: 'sets', id: null, updated_at: null },
        ],
      }
    })

    const versions = await createApi(client).cardImages.listImageVersions('u1')

    expect(Object.keys(versions)).toHaveLength(102)
    expect(versions['u1/c0.png']).toBe('2026-10-01T00:00:00Z')
    expect(versions['u1/c100.png']).toBe('2026-10-03T00:00:00Z')
    expect(versions['u1/sets/s1.png']).toBe('2026-10-02T00:00:00Z')
    expect(versions['u1/sets']).toBeUndefined()
    expect(requests.map((r) => r.url.pathname)).toEqual([
      '/storage/v1/object/list/flashcard-images',
      '/storage/v1/object/list/flashcard-images',
      '/storage/v1/object/list/flashcard-images',
    ])
    expect(requests.map((r) => (r.body as { prefix: string; offset: number }).offset)).toEqual([
      0, 100, 0,
    ])
  })
})
