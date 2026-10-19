import type { JevGrade, JevGrader } from '@/features/phrases/grading'
import { supabase } from '@/lib/supabase'

/** Calls the grade-phrase Edge Function. Throws on any failure; gradePhrase falls back. */
export const callGradePhrase: JevGrader = async (request, signal) => {
  const { data, error } = await supabase.functions.invoke<JevGrade>('grade-phrase', {
    body: request,
    signal,
  })
  if (error) throw error
  if (!data) throw new Error('grade-phrase returned no body')
  return data
}

/** Fire-and-forget: wakes a cold function so the first real grade is fast. */
export function warmUpGrader(): void {
  supabase.functions.invoke('grade-phrase', { body: { warmup: true } }).catch(() => {})
}
