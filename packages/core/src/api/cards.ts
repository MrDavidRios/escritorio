import type { SupabaseClient } from '@supabase/supabase-js'
import type { Card, CardInput } from '../types/card'

export function createCardsApi(supabase: SupabaseClient) {
  async function listCards(studySetId: string): Promise<Card[]> {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('study_set_id', studySetId)
      .order('position', { ascending: true })
    if (error) throw error
    return data
  }

  async function createCard(id: string, studySetId: string, input: CardInput): Promise<Card> {
    const { data, error } = await supabase
      .from('cards')
      .insert({ id, study_set_id: studySetId, ...input })
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  async function updateCard(id: string, input: Partial<CardInput>): Promise<Card> {
    const { data, error } = await supabase
      .from('cards')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    return data
  }

  async function deleteCard(id: string): Promise<void> {
    const { error } = await supabase.from('cards').delete().eq('id', id)
    if (error) throw error
  }

  return { listCards, createCard, updateCard, deleteCard }
}
