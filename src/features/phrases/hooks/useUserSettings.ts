import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getUserSettings, updateNewPhrasesPerDay } from '@/api/userSettings'
import type { UserSettings } from '@/types/phrase'

export function userSettingsKey() {
  return ['user-settings'] as const
}

export function useUserSettings() {
  return useQuery({ queryKey: userSettingsKey(), queryFn: getUserSettings })
}

export function useUpdateNewPhrasesPerDay(ownerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (value: number) => updateNewPhrasesPerDay(ownerId, value),
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: userSettingsKey() })
      const previous = queryClient.getQueryData<UserSettings>(userSettingsKey())
      queryClient.setQueryData<UserSettings>(userSettingsKey(), { new_phrases_per_day: value })
      return previous
    },
    onError: (_err, _value, previous) => {
      queryClient.setQueryData(userSettingsKey(), previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: userSettingsKey() }),
  })
}
