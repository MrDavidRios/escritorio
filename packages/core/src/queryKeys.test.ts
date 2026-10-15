import { describe, expect, it } from 'vitest'
import { queryKeys } from './queryKeys'

// These values are what the web app already stores in its query cache.
// Changing one silently breaks invalidation, so they're pinned exactly.
describe('queryKeys', () => {
  it('matches the keys the web app has always used', () => {
    expect(queryKeys.studySets()).toEqual(['study-sets'])
    expect(queryKeys.studySet('s1')).toEqual(['study-set', 's1'])
    expect(queryKeys.cards('s1')).toEqual(['cards', 's1'])
    expect(queryKeys.signedImageUrl('owner/card.png')).toEqual([
      'signed-image-url',
      'owner/card.png',
    ])
  })

  it('gives the set list and a single set distinct prefixes so invalidating one never hits the other', () => {
    expect(queryKeys.studySet('s1')[0]).not.toBe(queryKeys.studySets()[0])
  })
})
