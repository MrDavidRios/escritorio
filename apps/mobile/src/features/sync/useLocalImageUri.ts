import { useCallback, useSyncExternalStore } from 'react'
import { imageStore } from './instances'

/** The on-device file:// URI for a storage path, or null until it has been downloaded. */
export function useLocalImageUri(path: string | null): string | null {
  const getSnapshot = useCallback(() => imageStore.uriFor(path), [path])
  return useSyncExternalStore(imageStore.subscribe, getSnapshot)
}
