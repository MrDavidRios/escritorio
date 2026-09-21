import { supabase } from '@/lib/supabase'
import type { StudySession, StudySessionInput } from '@/types/studySession'

export async function createStudySession(input: StudySessionInput): Promise<StudySession> {
  const { data, error } = await supabase
    .from('study_sessions')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function completeStudySession(
  id: string,
  patch: { completed_at: string; cards_answered: number },
): Promise<StudySession> {
  const { data, error } = await supabase
    .from('study_sessions')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}
