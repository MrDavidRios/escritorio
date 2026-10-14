import { supabase } from '@/lib/supabase'
import type { UserSettings } from '@/types/phrase'

export const DEFAULT_NEW_PHRASES_PER_DAY = 10

/** A user without a settings row gets the defaults. */
export async function getUserSettings(): Promise<UserSettings> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('new_phrases_per_day')
    .maybeSingle()
  if (error) throw error
  return { new_phrases_per_day: data?.new_phrases_per_day ?? DEFAULT_NEW_PHRASES_PER_DAY }
}

export async function updateNewPhrasesPerDay(ownerId: string, value: number): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ owner_id: ownerId, new_phrases_per_day: value })
  if (error) throw error
}
