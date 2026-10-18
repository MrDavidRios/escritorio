import '../../global.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider'
import { readStoredUser } from '@/features/auth/storedUser'
import { bindAutoRefresh } from '@/lib/autoRefresh'
import { queryClient } from '@/lib/queryClient'
import { SESSION_STORAGE_KEY, sessionStorage, supabase } from '@/lib/supabase'

const readUser = () => readStoredUser(sessionStorage, SESSION_STORAGE_KEY)

function Routes() {
  const auth = useAuth()
  // Keep the splash screen (nothing rendered) until the stored session has been read.
  if (auth.status === 'loading') return null
  const signedIn = auth.status === 'signedIn'
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  useEffect(() => bindAutoRefresh(supabase.auth), [])
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider auth={supabase.auth} readStoredUser={readUser}>
        <Routes />
      </AuthProvider>
    </QueryClientProvider>
  )
}
