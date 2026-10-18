import { queryKeys } from '@escritorio/core'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Reads come from the persisted cache; the sync engine (features/sync) refreshes it.
// A query only fetches by itself when nothing is cached yet.
export function useStudySets() {
  return useQuery({ queryKey: queryKeys.studySets(), queryFn: api.studySets.listStudySets })
}

export function useStudySet(id: string) {
  return useQuery({
    queryKey: queryKeys.studySet(id),
    queryFn: () => api.studySets.getStudySet(id),
  })
}

export function useCards(studySetId: string) {
  return useQuery({
    queryKey: queryKeys.cards(studySetId),
    queryFn: () => api.cards.listCards(studySetId),
  })
}
