import { useQuery } from '@tanstack/react-query'
import { listCardImagePaths } from '@/api/cards'

const FALLBACK_IMAGE_COUNT = 3

/**
 * Up to the first few card image paths for a study set, ordered by
 * position -- used as a thumbnail fallback (front image + a couple
 * stacked behind) when the study set has no custom image of its own.
 * Deterministic: same set always returns the same paths in the same
 * order, so the fallback doesn't flicker between reloads.
 */
export function useStudySetFallbackImagePaths(studySetId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['card-image-paths', studySetId],
    queryFn: () => listCardImagePaths(studySetId, FALLBACK_IMAGE_COUNT),
    enabled,
  })
}
