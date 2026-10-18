import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Alert } from 'react-native'
import { useSignOut } from '@/features/auth/AuthProvider'
import { SetListScreen } from '@/features/sets/SetListScreen'
import { createConfirmSignOut } from '@/features/sync/confirmSignOut'
import { localData, outbox, syncEngine } from '@/features/sync/instances'
import { useSyncStatusLine } from '@/features/sync/useSyncStatusLine'

export default function SetListRoute() {
  const router = useRouter()
  const status = useSyncStatusLine()
  // Temporary home for sign-out until Settings (DR-15) owns it.
  const signOut = useSignOut()
  const confirmSignOut = useMemo(
    () =>
      createConfirmSignOut({
        pendingCount: () => outbox.getState().pending.length,
        signOut,
        wipe: () => localData.wipe(),
        alert: (title, message, buttons) => Alert.alert(title, message, buttons),
      }),
    [signOut],
  )
  return (
    <SetListScreen
      onOpenSet={(id) => router.push({ pathname: '/sets/[id]', params: { id } })}
      onSignOut={confirmSignOut}
      status={status}
      onRefresh={() => syncEngine.requestSync()}
    />
  )
}
