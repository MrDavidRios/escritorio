import { supabase } from '@/lib/supabase'

/** Keys of the flags that are on for the signed-in user. */
export async function getEnabledFeatureFlags(): Promise<string[]> {
  const { data, error } = await supabase.rpc('enabled_feature_flags')
  if (error) throw error
  return (data as string[] | null) ?? []
}
