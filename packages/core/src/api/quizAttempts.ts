import type { SupabaseClient } from '@supabase/supabase-js'
import type { QuizAttemptInput } from '../types/quizAttempt'

export function createQuizAttemptsApi(supabase: SupabaseClient) {
  // ON CONFLICT (id) DO NOTHING: re-sending an attempt that already landed
  // (e.g. the response was lost) is a no-op, not a duplicate row.
  async function createQuizAttempt(input: QuizAttemptInput): Promise<void> {
    const { error } = await supabase
      .from('quiz_attempts')
      .upsert(input, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  }

  return { createQuizAttempt }
}
