import { useMutation } from '@tanstack/react-query'
import { createQuizAttempt } from '@/api/quizAttempts'

/**
 * Fire-and-forget: a failed log write shouldn't block the quiz flow, so
 * callers use `mutate` (not `mutateAsync`) and this swallows errors after
 * logging them, rather than surfacing them in the UI.
 */
export function useLogQuizAttempt() {
  return useMutation({
    mutationFn: createQuizAttempt,
    onError: (error) => {
      console.error('Failed to log quiz attempt:', error)
    },
  })
}
