import { useQuery } from '@tanstack/react-query'
import { listIdioms } from '@/api/idioms'
import { pickIdiomOfTheDay } from './idiomOfTheDay'

const ONE_HOUR_MS = 60 * 60 * 1000

export function idiomsKey() {
  return ['idioms'] as const
}

export function useIdiomOfTheDay(date: Date) {
  const { data, isLoading, isError } = useQuery({
    queryKey: idiomsKey(),
    queryFn: listIdioms,
    staleTime: ONE_HOUR_MS,
  })

  return {
    idiom: data ? pickIdiomOfTheDay(data, date) : null,
    isLoading,
    isError,
  }
}
