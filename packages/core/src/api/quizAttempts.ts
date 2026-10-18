import type { SupabaseClient } from '@supabase/supabase-js'
import type { QuizAttemptInput } from '../types/quizAttempt'

export function createQuizAttemptsApi(supabase: SupabaseClient) {
  async function createQuizAttempt(input: QuizAttemptInput): Promise<void> {
    const { error } = await supabase.from('quiz_attempts').insert(input)
    if (error) throw error
  }

  return { createQuizAttempt }
}
