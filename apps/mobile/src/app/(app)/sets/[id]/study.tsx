import { useLocalSearchParams, useRouter } from 'expo-router'
import { StudyScreen } from '@/features/study/StudyScreen'
import { studyWriter } from '@/features/study/studyWriter'

export default function StudyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  return <StudyScreen id={id} writer={studyWriter} onClose={() => router.back()} />
}
