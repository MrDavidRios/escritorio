import 'react-native-get-random-values'
import 'react-native-url-polyfill/auto'
import Constants from 'expo-constants'
import { createClient } from '@supabase/supabase-js'
import { createLargeSecureStore } from './largeSecureStore'

// Set by app.config.ts from the repo-root .env.local.
const extra = Constants.expoConfig?.extra as
  { supabaseUrl?: string; supabaseAnonKey?: string } | undefined
const supabaseUrl = extra?.supabaseUrl
const supabaseAnonKey = extra?.supabaseAnonKey

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_ANON_KEY. Set them (or VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) in the repo-root .env.local.',
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
    // Google sign-in returns a ?code= to exchange (see features/auth/googleSignIn).
    flowType: 'pkce',
  },
})
