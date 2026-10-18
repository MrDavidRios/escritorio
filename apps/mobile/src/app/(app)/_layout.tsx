import { onlineManager } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { Alert, AppState } from 'react-native'
import { useAuth } from '@/features/auth/AuthProvider'
import { imageStore, localData, outbox, syncEngine } from '@/features/sync/instances'
import { HeaderOfflineButton } from '@/features/sync/HeaderOfflineButton'
import { SyncProvider, type SyncDeps } from '@/features/sync/SyncProvider'

const syncDeps: SyncDeps = {
  claimLocalData: (userId) => localData.claim(userId),
  load: async () => {
    await Promise.all([imageStore.load(), syncEngine.load()])
  },
  resumeOutbox: () => outbox.resume(),
  requestSync: () => syncEngine.requestSync(),
  appState: AppState,
  subscribeOnline: (listener) => onlineManager.subscribe(listener),
  alert: (title, message) => Alert.alert(title, message),
}

const offlineIcon = () => <HeaderOfflineButton />

export default function SignedInLayout() {
  const auth = useAuth()
  // The root layout only mounts this group when signed in.
  if (auth.status !== 'signedIn') return null
  return (
    // Keyed by user: a different account starts a fresh provider (not ready).
    <SyncProvider key={auth.user.id} userId={auth.user.id} deps={syncDeps}>
      <Stack>
        <Stack.Screen
          name="index"
          options={{ title: 'Study sets', headerLargeTitle: true, headerRight: offlineIcon }}
        />
        <Stack.Screen name="sets/[id]/index" options={{ title: '', headerRight: offlineIcon }} />
        {/* A focused task with its own Close button; no header means the
            KeyboardAvoidingView needs no header-height offset. */}
        <Stack.Screen
          name="sets/[id]/study"
          options={{ presentation: 'fullScreenModal', headerShown: false }}
        />
        <Stack.Screen
          name="offline"
          options={{
            presentation: 'formSheet',
            headerShown: false,
            sheetAllowedDetents: 'fitToContents',
            sheetGrabberVisible: true,
            sheetCornerRadius: 16,
          }}
        />
      </Stack>
    </SyncProvider>
  )
}
