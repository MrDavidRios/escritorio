import type { ConversionDirection } from './studySet'

export interface QuizAttemptInput {
  card_id: string
  is_correct: boolean
  attempt_count: number
  session_id: string | null
  resolved_direction: ConversionDirection | null
  // Client-generated when the attempt is recorded offline, so a retried
  // send is a no-op instead of a duplicate row. Omitted: the database
  // generates the id and stamps answered_at with now().
  id?: string
  answered_at?: string
}
