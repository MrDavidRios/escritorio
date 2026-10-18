import type { SupabaseClient } from '@supabase/supabase-js'
import type { Card, CardInput } from '../types/card'

// PostgREST caps one response at its max-rows setting (1000 on hosted Supabase).
const CARDS_PAGE_SIZE = 1000

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

  /** Every card the signed-in user owns (RLS scopes it), for the offline mirror. */
  async function listAllCards(): Promise<Card[]> {
    const all: Card[] = []
    for (let from = 0; ; from += CARDS_PAGE_SIZE) {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .order('study_set_id', { ascending: true })
        .order('position', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + CARDS_PAGE_SIZE - 1)
      if (error) throw error
      all.push(...data)
      if (data.length < CARDS_PAGE_SIZE) return all
    }
  }

  return { listCards, listAllCards, createCard, updateCard, deleteCard }
}
