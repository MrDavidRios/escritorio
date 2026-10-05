import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { getSignedImageUrl, SIGNED_URL_STALE_TIME_MS } from '@/api/cardImages'

interface SignedImage {
  path: string
  url: string | null
}

// Module-level so useQueries can memoize it: `data` keeps the same identity
// until some image's result actually changes.
function combineUrls(results: UseQueryResult<SignedImage>[]) {
  const data: Record<string, string> = {}
  for (const result of results) {
    if (result.data?.url) data[result.data.path] = result.data.url
  }
  return { data }
}

/**
 * Signed URLs for a set of image paths, cached per path. Adding, replacing
 * or removing one image only signs that image: every other path keeps its
 * cached URL, so unchanged <img> elements keep the same src (and the
 * browser's cached bytes) instead of reloading. Paths requested together
 * are signed in a single batched call.
 */
export function useSignedImageUrls(paths: string[]) {
  return useQueries({
    queries: [...new Set(paths)].map((path) => ({
      queryKey: ['signed-image-url', path],
      queryFn: async (): Promise<SignedImage> => ({ path, url: await getSignedImageUrl(path) }),
      staleTime: SIGNED_URL_STALE_TIME_MS,
    })),
    combine: combineUrls,
  })
}
