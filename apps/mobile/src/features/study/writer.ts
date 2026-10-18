import type { QuizAttemptInput, StudySessionInput } from '@escritorio/core'
import type { Outbox, OutboxOp } from '@/features/sync/outbox'

export type StudyWriter = {
  startSession(input: StudySessionInput & { id: string; started_at: string }): void
  recordAttempt(input: QuizAttemptInput & { id: string; answered_at: string }): void
  completeSession(id: string, patch: { completed_at: string; cards_correct: number }): void
}

/**
 * Study writes, queued in the persisted outbox so they survive being
 * offline or the app closing, then sent straight away when possible.
 */
export function createOutboxWriter(outbox: Pick<Outbox, 'enqueue' | 'flush'>): StudyWriter {
  function queue(op: OutboxOp) {
    void outbox.enqueue(op).then(() => outbox.flush())
  }
  return {
    startSession: (input) => queue({ type: 'createStudySession', id: input.id, input }),
    recordAttempt: (input) => queue({ type: 'createQuizAttempt', id: input.id, input }),
    completeSession: (id, patch) => queue({ type: 'completeStudySession', id, patch }),
  }
}
