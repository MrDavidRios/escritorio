import { supabase } from '@/lib/supabase'
import type { StudySet, StudySetInput, StudySetSummary } from '@/types/studySet'

const FALLBACK_IMAGE_COUNT = 3

// Embeds the first few card image paths (by position) with each set, so the
// dashboard can build thumbnail fallbacks without one extra query per set.
export async function listStudySets(): Promise<StudySetSummary[]> {
  const { data, error } = await supabase
    .from('study_sets')
    .select('*, cards(image_path)')
    .not('cards.image_path', 'is', null)
    .order('updated_at', { ascending: false })
    .order('position', { referencedTable: 'cards', ascending: true })
    .limit(FALLBACK_IMAGE_COUNT, { referencedTable: 'cards' })
    .returns<(StudySet & { cards: { image_path: string | null }[] })[]>()
  if (error) throw error
  return data.map(({ cards, ...studySet }) => ({
    ...studySet,
    fallback_image_paths: cards
      .map((card) => card.image_path)
      .filter((p): p is string => p != null),
  }))
}

export async function getStudySet(id: string): Promise<StudySet> {
  const { data, error } = await supabase.from('study_sets').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createStudySet(ownerId: string, input: StudySetInput): Promise<StudySet> {
  const { data, error } = await supabase
    .from('study_sets')
    .insert({ ...input, owner_id: ownerId })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateStudySet(id: string, input: Partial<StudySetInput>): Promise<StudySet> {
  const { data, error } = await supabase
    .from('study_sets')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteStudySet(id: string): Promise<void> {
  const { error } = await supabase.from('study_sets').delete().eq('id', id)
  if (error) throw error
}
