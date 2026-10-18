import { queryKeys, type Card } from '@escritorio/core'
import type { QueryClient } from '@tanstack/react-query'
import type { SyncedData } from './syncEngine'

const STUDY_SET_KEY = queryKeys.studySet('')[0]
const CARDS_KEY = queryKeys.cards('')[0]

/** Replaces the cached sets and cards with a fresh copy; sets deleted on the server disappear. */
export function applySyncedData(client: QueryClient, { sets, cards }: SyncedData): void {
  client.setQueryData(queryKeys.studySets(), sets)

  const cardsBySet = new Map<string, Card[]>(sets.map((set) => [set.id, []]))
  for (const card of cards) cardsBySet.get(card.study_set_id)?.push(card)

  for (const { fallback_image_paths: _fallbacks, ...studySet } of sets) {
    client.setQueryData(queryKeys.studySet(studySet.id), studySet)
    client.setQueryData(queryKeys.cards(studySet.id), cardsBySet.get(studySet.id))
  }

  const live = new Set(sets.map((set) => set.id))
  client.removeQueries({
    predicate: ({ queryKey: [key, id] }) =>
      (key === STUDY_SET_KEY || key === CARDS_KEY) && typeof id === 'string' && !live.has(id),
  })
}

export function wantedImagePaths({ sets, cards }: SyncedData): string[] {
  return [...cards.map((card) => card.image_path), ...sets.map((set) => set.image_path)].filter(
    (path): path is string => path != null,
  )
}
