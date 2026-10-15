import type { ConversionDirection, MeaningVisibility, StudyMode } from '@/types/studySet'

export interface StoredStudySettings {
  study_mode: StudyMode
  conversion_direction: ConversionDirection
  meaning_visibility: MeaningVisibility
}

function storageKey(studySetId: string) {
  return `study-config:${studySetId}`
}

export function loadStudySettings(studySetId: string): StoredStudySettings | null {
  try {
    const raw = localStorage.getItem(storageKey(studySetId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      (parsed?.study_mode === 'conversion' || parsed?.study_mode === 'meaning') &&
      typeof parsed.conversion_direction === 'string' &&
      typeof parsed.meaning_visibility === 'string'
    ) {
      return parsed as StoredStudySettings
    }
    return null
  } catch {
    return null
  }
}

export function saveStudySettings(studySetId: string, settings: StoredStudySettings): void {
  try {
    localStorage.setItem(storageKey(studySetId), JSON.stringify(settings))
  } catch {
    // Ignore write failures (e.g. private browsing) -- the setting just won't persist.
  }
}
