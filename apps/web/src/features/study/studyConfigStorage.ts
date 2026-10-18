import { parseStudySettings, studySettingsKey, type StudySettings } from '@escritorio/core'

export type StoredStudySettings = StudySettings

export function loadStudySettings(studySetId: string): StoredStudySettings | null {
  try {
    return parseStudySettings(localStorage.getItem(studySettingsKey(studySetId)))
  } catch {
    return null
  }
}

export function saveStudySettings(studySetId: string, settings: StoredStudySettings): void {
  try {
    localStorage.setItem(studySettingsKey(studySetId), JSON.stringify(settings))
  } catch {
    // Ignore write failures (e.g. private browsing) -- the setting just won't persist.
  }
}
