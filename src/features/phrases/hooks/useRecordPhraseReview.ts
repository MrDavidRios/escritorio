import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PhraseNotFoundError, recordPhraseReview } from '@/api/phraseReviews'
import { phrasesKey } from './usePhrases'

const SAVE_RETRIES = 2

/**
 * Saves one resolved phrase. Retries transient failures twice; a deleted
 * phrase isn't retried. Refetching phrases afterwards is safe mid-session
 * because the session page snapshots its queue at start.
 */
export function useRecordPhraseReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: recordPhraseReview,
    retry: (failureCount, error) =>
      failureCount < SAVE_RETRIES && !(error instanceof PhraseNotFoundError),
    onSettled: () => queryClient.invalidateQueries({ queryKey: phrasesKey() }),
  })
}
