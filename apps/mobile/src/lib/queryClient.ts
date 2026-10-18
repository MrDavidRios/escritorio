import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'

/**
 * Offline-first: cached data is persisted to the device and never expires.
 * The sync engine (features/sync) is what refreshes it; a query only fetches
 * by itself when nothing is cached yet.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { networkMode: 'offlineFirst', gcTime: Infinity, staleTime: Infinity },
      mutations: { networkMode: 'offlineFirst' },
    },
  })
}

export const queryClient = createQueryClient()

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'escritorio-query-cache',
})
