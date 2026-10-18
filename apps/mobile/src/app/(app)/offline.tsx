import { useRouter } from 'expo-router'
import { OfflineDetails } from '@/features/sync/OfflineDetails'
import { useSyncSummary } from '@/features/sync/useSyncSummary'

export default function OfflineRoute() {
  const router = useRouter()
  const { online, pendingAnswers, lastSyncedAt, now } = useSyncSummary()
  return (
    <OfflineDetails
      online={online}
      pendingAnswers={pendingAnswers}
      lastSyncedAt={lastSyncedAt}
      now={now}
      onDone={() => router.back()}
    />
  )
}
