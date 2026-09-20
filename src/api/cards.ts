import { supabase } from '@/lib/supabase'
import type { Card, CardInput } from '@/types/card'

export async function listCards(studySetId: string): Promise<Card[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('study_set_id', studySetId)
    .order('position', { ascending: true })
  if (error) throw error
  return data
}

// Lightweight query for study-set thumbnail fallbacks: just the first few
// image paths by position, without pulling full card rows.
export async function listCardImagePaths(studySetId: string, limit: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('image_path')
    .eq('study_set_id', studySetId)
    .not('image_path', 'is', null)
    .order('position', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data.map((row) => row.image_path).filter((p): p is string => p != null)
}

export async function createCard(id: string, studySetId: string, input: CardInput): Promise<Card> {
  const { data, error } = await supabase
    .from('cards')
    .insert({ id, study_set_id: studySetId, ...input })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateCard(id: string, input: Partial<CardInput>): Promise<Card> {
  const { data, error } = await supabase
    .from('cards')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase.from('cards').delete().eq('id', id)
  if (error) throw error
}
