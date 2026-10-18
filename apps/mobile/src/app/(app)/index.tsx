import { useRouter } from 'expo-router'
import { SetListScreen } from '@/features/sets/SetListScreen'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'

export default function SetListRoute() {
  const router = useRouter()
  return (
    <SetListScreen
      onOpenSet={(id) => router.push({ pathname: '/sets/[id]', params: { id } })}
      onSignOut={async () => {
        // Temporary until Settings (DR-15) owns sign-out and the outbox warning.
        await supabase.auth.signOut()
        queryClient.clear()
      }}
    />
  )
}
