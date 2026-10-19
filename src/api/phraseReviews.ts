import type { ScheduleUpdate } from '@/features/phrases/scheduler'
import { supabase } from '@/lib/supabase'
import type { DateKey, JevVerdict, PhraseGradeSource, PhraseRating } from '@/types/phrase'

/** The phrase was deleted (or isn't yours) -- nothing to save. */
export class PhraseNotFoundError extends Error {}

export interface RecordPhraseReviewInput {
  phraseId: string
  reviewedOn: DateKey
  rating: PhraseRating
  attemptCount: number
  typedAnswer: string
  gradeSource: PhraseGradeSource
  jevVerdict: JevVerdict | null
  isPractice: boolean
  /** Required unless isPractice; ignored by the database for practice. */
  schedule: ScheduleUpdate | null
}

export async function recordPhraseReview(input: RecordPhraseReviewInput): Promise<void> {
  const { error } = await supabase.rpc('record_phrase_review', {
    p_phrase_id: input.phraseId,
    p_reviewed_on: input.reviewedOn,
    p_rating: input.rating,
    p_attempt_count: input.attemptCount,
    p_typed_answer: input.typedAnswer.slice(0, 500),
    p_grade_source: input.gradeSource,
    p_jev_verdict: input.jevVerdict,
    p_is_practice: input.isPractice,
    p_due_on: input.schedule?.due_on ?? null,
    p_interval_days: input.schedule?.interval_days ?? null,
    p_ease: input.schedule?.ease ?? null,
    p_reps: input.schedule?.reps ?? null,
    p_lapses: input.schedule?.lapses ?? null,
  })
  if (!error) return
  // Not due any more: a retry or another tab already recorded this review.
  if (error.code === 'PR409') return
  if (error.code === 'PR404') throw new PhraseNotFoundError(error.message)
  throw error
}
