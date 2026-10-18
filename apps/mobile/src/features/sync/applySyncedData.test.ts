import { queryKeys, type StudySetSummary } from '@escritorio/core'
import { QueryClient } from '@tanstack/react-query'
import { makeCard, makeStudySet } from '@/test/fixtures'
import { applySyncedData, wantedImagePaths } from './applySyncedData'

const summary = (id: string, image_path: string | null = null): StudySetSummary => ({
  ...makeStudySet({ id, image_path }),
  fallback_image_paths: [],
})

test('writes every set and its cards into the cache, and drops deleted sets', () => {
  // No garbage-collection timers, so Jest can exit.
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
  client.setQueryData(queryKeys.studySet('gone'), makeStudySet({ id: 'gone' }))
  client.setQueryData(queryKeys.cards('gone'), [])
  const a = makeCard({ id: 'c1', study_set_id: 's1', position: 0 })
  const b = makeCard({ id: 'c2', study_set_id: 's1', position: 1 })

  applySyncedData(client, { sets: [summary('s1'), summary('s2')], cards: [a, b] })

  expect(client.getQueryData(queryKeys.studySets())).toHaveLength(2)
  expect(client.getQueryData(queryKeys.studySet('s1'))).toEqual(makeStudySet({ id: 's1' }))
  expect(client.getQueryData(queryKeys.cards('s1'))).toEqual([a, b])
  expect(client.getQueryData(queryKeys.cards('s2'))).toEqual([])
  expect(client.getQueryData(queryKeys.studySet('gone'))).toBeUndefined()
  expect(client.getQueryData(queryKeys.cards('gone'))).toBeUndefined()
})

test('wants every card image and set cover', () => {
  expect(
    wantedImagePaths({
      sets: [summary('s1', 'u/sets/s1.png'), summary('s2')],
      cards: [makeCard({ image_path: 'u/c1.png' }), makeCard({ id: 'c2', image_path: null })],
    }),
  ).toEqual(['u/c1.png', 'u/sets/s1.png'])
})
