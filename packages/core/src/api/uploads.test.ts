import { describe, expect, it } from 'vitest'
import { createApi } from './index'
import { fakeSupabase } from './testing/fakeSupabase'

const ok = () => ({ body: { Key: 'flashcard-images/x', Id: 'x' } })

describe.each([
  [
    'card image',
    (api: ReturnType<typeof createApi>) => api.cardImages.uploadCardImage,
    'u/c1.webp',
  ],
  [
    'study set image',
    (api: ReturnType<typeof createApi>) => api.studySetImages.uploadStudySetImage,
    'u/sets/s1.webp',
  ],
] as const)('upload %s', (_, pick, path) => {
  it('sends an ArrayBuffer with the given content type', async () => {
    const { client, requests } = fakeSupabase(ok)

    await pick(createApi(client))(path, new Uint8Array([1, 2, 3]).buffer, {
      contentType: 'image/webp',
    })

    expect(requests[0].method).toBe('POST')
    expect(requests[0].url.pathname).toBe(`/storage/v1/object/flashcard-images/${path}`)
    expect(requests[0].headers.get('content-type')).toBe('image/webp')
    expect(requests[0].headers.get('x-upsert')).toBe('false')
  })

  it('sends a Blob as multipart, keeping the blob’s own type', async () => {
    const { client, requests } = fakeSupabase(ok)

    await pick(createApi(client))(path, new Blob(['img'], { type: 'image/png' }), {
      contentType: 'image/png',
    })

    expect(requests[0].headers.get('content-type')).toMatch(/^multipart\/form-data/)
    expect(String(requests[0].body)).toContain('Content-Type: image/png')
  })

  it('overwrites when upsert is set', async () => {
    const { client, requests } = fakeSupabase(ok)

    await pick(createApi(client))(path, new Uint8Array([1]).buffer, {
      contentType: 'image/webp',
      upsert: true,
    })

    expect(requests[0].headers.get('x-upsert')).toBe('true')
  })
})
