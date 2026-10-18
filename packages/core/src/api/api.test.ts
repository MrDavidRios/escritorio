import { describe, expect, it } from 'vitest'
import { createApi } from './index'
import { fakeSupabase } from './testing/fakeSupabase'

describe('createApi', () => {
  it('exposes one namespace per table/bucket', () => {
    const api = createApi(fakeSupabase().client)
    expect(Object.keys(api).sort()).toEqual([
      'cardImages',
      'cards',
      'quizAttempts',
      'studySessions',
      'studySetImages',
      'studySets',
    ])
  })

  it('sends queries through the injected client', async () => {
    const card = { id: 'c1', study_set_id: 's1', position: 0 }
    const { client, requests } = fakeSupabase(() => ({ body: [card] }))

    const cards = await createApi(client).cards.listCards('s1')

    expect(cards).toEqual([card])
    expect(requests).toHaveLength(1)
    expect(requests[0].method).toBe('GET')
    expect(requests[0].url.pathname).toBe('/rest/v1/cards')
    expect(requests[0].url.searchParams.get('study_set_id')).toBe('eq.s1')
    expect(requests[0].url.searchParams.get('order')).toBe('position.asc')
  })

  it('flattens embedded card image paths into fallback_image_paths', async () => {
    const { client } = fakeSupabase(() => ({
      body: [{ id: 's1', title: 'Set', cards: [{ image_path: 'u/a.webp' }, { image_path: null }] }],
    }))

    const sets = await createApi(client).studySets.listStudySets()

    expect(sets).toEqual([{ id: 's1', title: 'Set', fallback_image_paths: ['u/a.webp'] }])
  })

  it('throws the Supabase error when a request fails', async () => {
    const { client } = fakeSupabase(() => ({
      status: 400,
      body: { code: '22P02', message: 'invalid input syntax for type uuid' },
    }))

    await expect(createApi(client).cards.listCards('nope')).rejects.toMatchObject({
      code: '22P02',
    })
  })

  it('batches signed-URL requests made in the same tick', async () => {
    const { client, requests } = fakeSupabase(() => ({
      body: [
        { path: 'u/a.webp', signedURL: '/object/sign/flashcard-images/u/a.webp?token=a' },
        { path: 'u/b.webp', signedURL: '/object/sign/flashcard-images/u/b.webp?token=b' },
      ],
    }))
    const api = createApi(client)

    const [a, b] = await Promise.all([
      api.cardImages.getSignedImageUrl('u/a.webp'),
      api.cardImages.getSignedImageUrl('u/b.webp'),
    ])

    expect(requests).toHaveLength(1)
    expect(requests[0].url.pathname).toBe('/storage/v1/object/sign/flashcard-images')
    expect(a).toContain('token=a')
    expect(b).toContain('token=b')
  })
})
