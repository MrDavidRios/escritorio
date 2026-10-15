import { supabase } from '@/lib/supabase'
import type { Idiom } from '@escritorio/core'

export async function listIdioms(): Promise<Idiom[]> {
  const { data, error } = await supabase.from('idioms').select('*').order('seq')
  if (error) throw error
  return data
}
