import { useLocalSearchParams, useRouter } from 'expo-router'
import { SetDetailScreen } from '@/features/sets/SetDetailScreen'

export default function SetDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  return (
    <SetDetailScreen
      id={id}
      onStudy={() => router.push({ pathname: '/sets/[id]/study', params: { id } })}
    />
  )
}
