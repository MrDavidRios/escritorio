import { supabase } from '@/lib/supabase'
import type { QuizAttemptInput } from '@escritorio/core'

export async function createQuizAttempt(input: QuizAttemptInput): Promise<void> {
  const { error } = await supabase.from('quiz_attempts').insert(input)
  if (error) throw error
}
