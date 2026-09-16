import { supabase } from '@/lib/supabase'
import type { StudySet, StudySetInput } from '@/types/studySet'

export async function listStudySets(): Promise<StudySet[]> {
  const { data, error } = await supabase
    .from('study_sets')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getStudySet(id: string): Promise<StudySet> {
  const { data, error } = await supabase
    .from('study_sets')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createStudySet(
  ownerId: string,
  input: StudySetInput,
): Promise<StudySet> {
  const { data, error } = await supabase
    .from('study_sets')
    .insert({ ...input, owner_id: ownerId })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateStudySet(
  id: string,
  input: StudySetInput,
): Promise<StudySet> {
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
