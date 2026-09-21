import type { ConversionDirection, MeaningVisibility, StudyMode } from './studySet'

export interface StudySession {
  id: string
  study_set_id: string
  owner_id: string
  mode: StudyMode
  direction: ConversionDirection | null
  visibility: MeaningVisibility | null
  deck_size: number
  cards_correct: number
  started_at: string
  completed_at: string | null
}

export interface StudySessionInput {
  study_set_id: string
  mode: StudyMode
  direction: ConversionDirection | null
  visibility: MeaningVisibility | null
  deck_size: number
}
