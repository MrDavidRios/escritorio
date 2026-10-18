import { useRouter } from 'expo-router'
import { OfflineButton } from './OfflineButton'
import { useSyncSummary } from './useSyncSummary'

/** The offline icon for a header; opens the /offline details sheet. */
export function HeaderOfflineButton() {
  const router = useRouter()
  const { online } = useSyncSummary()
  return <OfflineButton online={online} onPress={() => router.push('/offline')} />
}
