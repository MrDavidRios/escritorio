export interface StudySet {
  id: string
  owner_id: string
  title: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface StudySetInput {
  title: string
  description: string | null
}
