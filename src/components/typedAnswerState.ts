export const MAX_ATTEMPTS = 3

export interface GradeOutcome {
  correct: boolean
  /** Shown in place of "Correct!" (e.g. the exact form after a near miss). */
  note?: string | null
}

export type Feedback =
  | { kind: 'correct'; note: string | null }
  | { kind: 'retry'; attemptsLeft: number }
  | { kind: 'revealed' }

export interface AnswerState {
  attempts: number
  feedback: Feedback | null
}

/** A question is resolved when it's answered correctly or revealed. */
export interface Resolution<G> {
  correct: boolean
  attemptCount: number
  typed: string
  outcome: G
}

export const INITIAL_ANSWER_STATE: AnswerState = { attempts: 0, feedback: null }

export function isLocked(state: AnswerState): boolean {
  return state.feedback?.kind === 'correct' || state.feedback?.kind === 'revealed'
}

/**
 * One graded attempt. A wrong answer gets up to MAX_ATTEMPTS tries before
 * revealing; only a correct answer or the final miss resolves the question.
 */
export function applyGrade<G extends GradeOutcome>(
  state: AnswerState,
  typed: string,
  outcome: G,
): { state: AnswerState; resolution: Resolution<G> | null } {
  const attempts = state.attempts + 1
  if (outcome.correct) {
    return {
      state: { attempts, feedback: { kind: 'correct', note: outcome.note ?? null } },
      resolution: { correct: true, attemptCount: attempts, typed, outcome },
    }
  }
  if (attempts >= MAX_ATTEMPTS) {
    return {
      state: { attempts, feedback: { kind: 'revealed' } },
      resolution: { correct: false, attemptCount: attempts, typed, outcome },
    }
  }
  return {
    state: { attempts, feedback: { kind: 'retry', attemptsLeft: MAX_ATTEMPTS - attempts } },
    resolution: null,
  }
}
