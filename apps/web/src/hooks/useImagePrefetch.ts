import { useEffect, useRef } from 'react'

/**
 * Warms the browser's image cache for a whole batch of URLs up front
 * (e.g. every card in a study set, once their signed URLs resolve),
 * so later <img> renders are instant instead of each starting its own
 * fetch. Fire-and-forget: failures here don't matter, the <img> tag
 * will just fetch normally if a prefetch didn't land.
 */
export function useImagePrefetch(urls: string[]) {
  const prefetched = useRef(new Set<string>())

  useEffect(() => {
    for (const url of urls) {
      if (prefetched.current.has(url)) continue
      prefetched.current.add(url)
      const img = new Image()
      img.src = url
    }
  }, [urls])
}
