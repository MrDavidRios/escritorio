import { useQuery } from '@tanstack/react-query'
import { getSignedImageUrls, SIGNED_URL_STALE_TIME_MS } from '@/api/cardImages'

export function useSignedImageUrls(paths: string[]) {
  const sortedKey = [...paths].sort().join(',')

  return useQuery({
    queryKey: ['signed-image-urls', sortedKey],
    queryFn: () => getSignedImageUrls(paths),
    enabled: paths.length > 0,
    staleTime: SIGNED_URL_STALE_TIME_MS,
  })
}
