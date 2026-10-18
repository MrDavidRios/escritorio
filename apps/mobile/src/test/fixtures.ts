import type { Card, StudySet } from '@escritorio/core'

const STAMP = '2026-10-01T00:00:00.000Z'

export function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'c1',
    study_set_id: 's1',
    owner_id: 'u1',
    image_path: null,
    spanish_term: 'hablar',
    english_equivalent: 'to speak',
    definition: null,
    hint: null,
    position: 0,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  }
}

export function makeStudySet(overrides: Partial<StudySet> = {}): StudySet {
  return {
    id: 's1',
    owner_id: 'u1',
    title: 'Verbos',
    description: null,
    image_path: null,
    study_mode: 'conversion',
    conversion_direction: 'es_en',
    meaning_visibility: 'image',
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  }
}
