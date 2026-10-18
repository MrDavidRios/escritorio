import AsyncStorage from '@react-native-async-storage/async-storage'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { onlineManager } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import { applySyncedData, wantedImagePaths } from './applySyncedData'
import { imageFiles } from './imageFiles'
import { createImageStore } from './imageStore'
import { createLocalData } from './localData'
import { createOutbox, type RefreshResult } from './outbox'
import { createSyncEngine } from './syncEngine'

// The app's single instances of the offline machinery. Modules that need
// them import from here; tests build their own with fakes.

async function refreshAuth(): Promise<RefreshResult> {
  const { error } = await supabase.auth.refreshSession()
  if (!error) return 'refreshed'
  return isAuthRetryableFetchError(error) ? 'offline' : 'rejected'
}

export const outbox = createOutbox({ api, storage: AsyncStorage, refreshAuth })

export const imageStore = createImageStore({
  files: imageFiles,
  api: api.cardImages,
  storage: AsyncStorage,
})

export const syncEngine = createSyncEngine({
  isOnline: () => onlineManager.isOnline(),
  flushOutbox: () => outbox.flush(),
  fetchData: async () => {
    const [sets, cards] = await Promise.all([
      api.studySets.listStudySets(),
      api.cards.listAllCards(),
    ])
    return { sets, cards }
  },
  applyData: (data) => applySyncedData(queryClient, data),
  // Every set has the same owner: the signed-in user (RLS).
  syncImages: (data) => imageStore.sync(wantedImagePaths(data), data.sets[0]?.owner_id ?? null),
  storage: AsyncStorage,
})

export const localData = createLocalData({
  storage: AsyncStorage,
  clearCache: () => queryClient.clear(),
  clearImages: () => imageStore.clear(),
  clearOutbox: () => outbox.clear(),
  clearSyncStatus: () => syncEngine.clear(),
})
