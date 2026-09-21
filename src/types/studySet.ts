export type StudyMode = 'conversion' | 'meaning'
export type ConversionDirection = 'en_es' | 'es_en' | 'random'
export type MeaningVisibility = 'image' | 'definition' | 'both'

export interface StudySet {
  id: string
  owner_id: string
  title: string
  description: string | null
  image_path: string | null
  study_mode: StudyMode
  conversion_direction: ConversionDirection
  meaning_visibility: MeaningVisibility
  created_at: string
  updated_at: string
}

export interface StudySetInput {
  title: string
  description: string | null
  image_path?: string | null
  study_mode?: StudyMode
  conversion_direction?: ConversionDirection
  meaning_visibility?: MeaningVisibility
}
