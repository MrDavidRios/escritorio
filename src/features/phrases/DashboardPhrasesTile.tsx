import { useMemo } from 'react'
import { DEFAULT_NEW_PHRASES_PER_DAY } from '@/api/userSettings'
import { dueToday } from './dailyQueue'
import { todayKey } from './dates'
import { usePhrases } from './hooks/usePhrases'
import { useUserSettings } from './hooks/useUserSettings'
import { PhrasesTile } from './PhrasesTile'

/** Feeds PhrasesTile today's due count. */
export function DashboardPhrasesTile() {
  const { data: phrases, isError: phrasesError } = usePhrases()
  const { data: settings, isError: settingsError } = useUserSettings()
  const dueCount = useMemo(() => {
    // Wait for settings (or their failure) so the count never flashes the default cap.
    if (!phrases || (!settings && !settingsError)) return null
    const { reviews, fresh } = dueToday(
      phrases,
      todayKey(),
      settings?.new_phrases_per_day ?? DEFAULT_NEW_PHRASES_PER_DAY,
    )
    return reviews.length + fresh.length
  }, [phrases, settings, settingsError])

  return <PhrasesTile dueCount={dueCount} error={phrasesError} />
}
