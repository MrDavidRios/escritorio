export interface Idiom {
  id: string
  /** Insertion order; stable across appends, used to order the rotation. */
  seq: number
  spanish: string
  english: string
  example: string | null
  source_url: string
  /** Local calendar date (YYYY-MM-DD) this idiom is pinned to, or null. */
  featured_on: string | null
  created_at: string
}
