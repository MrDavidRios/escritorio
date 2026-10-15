export interface Card {
  id: string
  study_set_id: string
  owner_id: string
  image_path: string | null
  spanish_term: string
  english_equivalent: string | null
  definition: string | null
  hint: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface CardInput {
  image_path: string | null
  spanish_term: string
  english_equivalent: string | null
  definition: string | null
  hint: string | null
  position: number
}
