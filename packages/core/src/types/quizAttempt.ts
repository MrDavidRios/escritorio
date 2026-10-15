import type { ConversionDirection } from './studySet'

export interface QuizAttemptInput {
  card_id: string
  is_correct: boolean
  attempt_count: number
  session_id: string | null
  resolved_direction: ConversionDirection | null
}
