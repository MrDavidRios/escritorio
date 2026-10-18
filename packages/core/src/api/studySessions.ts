import type { SupabaseClient } from '@supabase/supabase-js'
import type { StudySession, StudySessionInput } from '../types/studySession'

export function createStudySessionsApi(supabase: SupabaseClient) {
  async function createStudySession(input: StudySessionInput): Promise<StudySession> {
    const { data, error } = await supabase.from('study_sessions').insert(input).select('*').single()
    if (error) throw error
    return data
  }

  async function completeStudySession(
    id: string,
    patch: { completed_at: string; cards_correct: number },
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

  return { createStudySession, completeStudySession }
}
