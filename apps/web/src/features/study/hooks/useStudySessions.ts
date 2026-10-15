import { useMutation } from '@tanstack/react-query'
import { completeStudySession, createStudySession } from '@/api/studySessions'

/**
 * Opens a study_sessions row at the start of a session. Fire during
 * mount, before any attempts are logged, so attempts can carry the
 * resulting session_id.
 */
export function useStartStudySession() {
  return useMutation({
    mutationFn: createStudySession,
    onError: (error) => {
      console.error('Failed to start study session:', error)
    },
  })
}

/**
 * Closes a study_sessions row once the deck is exhausted. Fire-and-
 * forget from the caller's perspective, like useLogQuizAttempt -- a
 * failed completion write shouldn't block showing the "Nice work!"
 * screen.
 */
export function useCompleteStudySession() {
  return useMutation({
    mutationFn: ({ id, cardsAnswered }: { id: string; cardsAnswered: number }) =>
      completeStudySession(id, { completed_at: new Date().toISOString(), cards_correct: cardsAnswered }),
    onError: (error) => {
      console.error('Failed to mark study session complete:', error)
    },
  })
}
