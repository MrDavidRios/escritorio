import { queryKeys } from '@escritorio/core'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Online-only for now; DR-14 persists this cache and mirrors images for offline use.
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

export function useSignedImageUrl(path: string | null) {
  return useQuery({
    queryKey: queryKeys.signedImageUrl(path ?? ''),
    queryFn: () => api.cardImages.getSignedImageUrl(path!),
    enabled: path != null,
  })
}
