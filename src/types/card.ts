export interface Card {
  id: string
  study_set_id: string
  owner_id: string
  image_path: string
  hint: string | null
  answer: string
  position: number
  created_at: string
  updated_at: string
}

export interface CardInput {
  image_path: string
  hint: string | null
  answer: string
  position: number
}
