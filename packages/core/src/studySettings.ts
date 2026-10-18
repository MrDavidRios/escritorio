import type { ConversionDirection, MeaningVisibility, StudyMode, StudySet } from './types/studySet'

/**
 * The study mode a learner picked for a set. Each device keeps its own
 * (web: localStorage, mobile: AsyncStorage) and falls back to the set's own
 * fields; it is never written to Supabase.
 */
export type StudySettings = Pick<
  StudySet,
  'study_mode' | 'conversion_direction' | 'meaning_visibility'
>

const MODES: readonly StudyMode[] = ['conversion', 'meaning']
const DIRECTIONS: readonly ConversionDirection[] = ['en_es', 'es_en', 'random']
const VISIBILITIES: readonly MeaningVisibility[] = ['image', 'definition', 'both']

export function studySettingsKey(studySetId: string): string {
  return `study-config:${studySetId}`
}

/** Returns null for anything that isn't a complete, valid stored value. */
export function parseStudySettings(raw: string | null): StudySettings | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { study_mode, conversion_direction, meaning_visibility } = parsed as Record<string, unknown>
  if (
    !MODES.includes(study_mode as StudyMode) ||
    !DIRECTIONS.includes(conversion_direction as ConversionDirection) ||
    !VISIBILITIES.includes(meaning_visibility as MeaningVisibility)
  ) {
    return null
  }
  return { study_mode, conversion_direction, meaning_visibility } as StudySettings
}
