import { useLocalSearchParams } from 'expo-router'
import { SetDetailScreen } from '@/features/sets/SetDetailScreen'

export default function SetDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <SetDetailScreen id={id} />
}
