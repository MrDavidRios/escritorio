import { parseStudySettings, studySettingsKey, type StudySettings } from '@escritorio/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useStudySet } from './hooks'

const storedSettingsKey = (id: string) => ['study-settings', id] as const

async function loadStudySettings(id: string): Promise<StudySettings | null> {
  try {
    return parseStudySettings(await AsyncStorage.getItem(studySettingsKey(id)))
  } catch {
    return null
  }
}

async function saveStudySettings(id: string, settings: StudySettings): Promise<void> {
  try {
    await AsyncStorage.setItem(studySettingsKey(id), JSON.stringify(settings))
  } catch {
    // Ignore write failures; the choice just won't survive a restart.
  }
}

/**
 * The study mode for a set on this device, the same way web does it: a
 * choice made here wins, otherwise the set's own fields. Never written to
 * Supabase, so it works offline and doesn't change other devices.
 */
export function useStudySettings(id: string) {
  const queryClient = useQueryClient()
  const { data: studySet } = useStudySet(id)
  const stored = useQuery({
    queryKey: storedSettingsKey(id),
    queryFn: () => loadStudySettings(id),
    staleTime: Infinity,
    // Local storage: don't pause the read while the device is offline.
    networkMode: 'always',
  })

  const settings: StudySettings | undefined = !stored.isSuccess
    ? undefined
    : (stored.data ??
      (studySet && {
        study_mode: studySet.study_mode,
        conversion_direction: studySet.conversion_direction,
        meaning_visibility: studySet.meaning_visibility,
      }))

  function update(patch: Partial<StudySettings>) {
    if (!settings) return
    const next = { ...settings, ...patch }
    queryClient.setQueryData(storedSettingsKey(id), next)
    void saveStudySettings(id, next)
  }

  return { settings, update }
}
