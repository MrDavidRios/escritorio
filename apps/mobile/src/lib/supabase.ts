import 'react-native-get-random-values'
import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import { createLargeSecureStore } from './largeSecureStore'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy apps/mobile/.env.local.example to apps/mobile/.env.local and fill in your Supabase project values.',
  )
}

// Fixed (rather than auth-js's project-derived default) so the offline
// sign-in check in AuthProvider can read the stored session itself.
export const SESSION_STORAGE_KEY = 'escritorio-auth'

export const sessionStorage = createLargeSecureStore()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sessionStorage,
    storageKey: SESSION_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})
