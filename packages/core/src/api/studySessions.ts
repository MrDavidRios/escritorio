import type { SupabaseClient } from '@supabase/supabase-js'
import type { StudySession, StudySessionInput } from '../types/studySession'

export function createStudySessionsApi(supabase: SupabaseClient) {
  /**
   * ON CONFLICT (id) DO NOTHING, like createQuizAttempt. Resolves to null
   * when a session with this id already existed: the earlier send landed.
   */
  async function createStudySession(input: StudySessionInput): Promise<StudySession | null> {
    const { data, error } = await supabase
      .from('study_sessions')
      .upsert(input, { onConflict: 'id', ignoreDuplicates: true })
      .select('*')
      .maybeSingle()
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
