import AsyncStorage from '@react-native-async-storage/async-storage'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { createOutbox, type RefreshResult } from './outbox'

// The app's single instances of the offline machinery. Modules that need
// them import from here; tests build their own with fakes.

async function refreshAuth(): Promise<RefreshResult> {
  const { error } = await supabase.auth.refreshSession()
  if (!error) return 'refreshed'
  return isAuthRetryableFetchError(error) ? 'offline' : 'rejected'
}

export const outbox = createOutbox({ api, storage: AsyncStorage, refreshAuth })
