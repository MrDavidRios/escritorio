import type { Api, QuizAttemptInput, StudySessionInput } from '@escritorio/core'

export type StudyWritesApi = {
  studySessions: Pick<Api['studySessions'], 'createStudySession' | 'completeStudySession'>
  quizAttempts: Pick<Api['quizAttempts'], 'createQuizAttempt'>
}

export type StudyWriter = {
  startSession(input: StudySessionInput & { id: string; started_at: string }): void
  recordAttempt(input: QuizAttemptInput & { id: string; answered_at: string }): void
  completeSession(id: string, patch: { completed_at: string; cards_correct: number }): void
  /** Resolves once every write queued so far has settled. */
  idle(): Promise<void>
}

/**
 * Saves a study run's writes one at a time, in the order they were made:
 * an attempt must not reach Supabase before its session row exists. A
 * failed write is reported and skipped so the quiz never blocks on the
 * network. In-memory and online-only for now; DR-14 replaces this queue
 * with the persisted outbox (same ops, same client ids).
 */
export function createStudyWriter(
  api: StudyWritesApi,
  onError: (error: unknown) => void = (error) =>
    console.error('Failed to save study progress:', error),
): StudyWriter {
  let tail: Promise<void> = Promise.resolve()

  function enqueue(write: () => Promise<unknown>) {
    tail = tail.then(write).then(() => undefined, onError)
  }

  return {
    startSession: (input) => enqueue(() => api.studySessions.createStudySession(input)),
    recordAttempt: (input) => enqueue(() => api.quizAttempts.createQuizAttempt(input)),
    completeSession: (id, patch) =>
      enqueue(() => api.studySessions.completeStudySession(id, patch)),
    idle: () => tail,
  }
}
