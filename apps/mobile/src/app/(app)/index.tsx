import { useRouter } from 'expo-router'
import { useSignOut } from '@/features/auth/AuthProvider'
import { SetListScreen } from '@/features/sets/SetListScreen'

export default function SetListRoute() {
  const router = useRouter()
  // Temporary home for sign-out until Settings (DR-15) owns it and the outbox warning.
  const signOut = useSignOut()
  return (
    <SetListScreen
      onOpenSet={(id) => router.push({ pathname: '/sets/[id]', params: { id } })}
      onSignOut={signOut}
    />
  )
}
