/** Local calendar date as YYYY-MM-DD (see localDateKey). */
export type DateKey = string

export type PhraseRating = 'again' | 'hard' | 'good'
export type PhraseGradeSource = 'exact' | 'jev' | 'fallback'
export type JevVerdict = 'exact' | 'minor_slip' | 'valid_variant' | 'wrong'

export interface PhraseSchedule {
  /** Null while the phrase is new (not yet introduced). */
  due_on: DateKey | null
  introduced_on: DateKey | null
  interval_days: number
  ease: number
  reps: number
  lapses: number
}

export interface Phrase extends PhraseSchedule {
  id: string
  owner_id: string
  spanish: string
  english: string
  example: string | null
  image_path: string | null
  /** Set when added from the idiom list; content is a copy, not a link. */
  idiom_id: string | null
  created_at: string
  updated_at: string
}

export interface PhraseInput {
  spanish: string
  english: string
  example: string | null
  image_path: string | null
  idiom_id: string | null
}

export interface UserSettings {
  new_phrases_per_day: number
}
