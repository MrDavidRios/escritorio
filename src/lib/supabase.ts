import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.local.example to .env.local and fill in your Supabase project values.',
  )
}

// The anon key is safe to ship in a public bundle: it only grants whatever
// Row Level Security policies allow. RLS is the actual security boundary,
// not the secrecy of this key.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
