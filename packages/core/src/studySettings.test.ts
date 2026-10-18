import { describe, expect, it } from 'vitest'
import { parseStudySettings, studySettingsKey } from './studySettings'

const valid = { study_mode: 'meaning', conversion_direction: 'es_en', meaning_visibility: 'image' }

describe('studySettingsKey', () => {
  it("uses web's existing localStorage key", () => {
    expect(studySettingsKey('set-1')).toBe('study-config:set-1')
  })
})

describe('parseStudySettings', () => {
  it('reads a stored value', () => {
    expect(parseStudySettings(JSON.stringify(valid))).toEqual(valid)
  })

  it('keeps only the three settings fields', () => {
    expect(parseStudySettings(JSON.stringify({ ...valid, title: 'x' }))).toEqual(valid)
  })

  it.each([
    ['nothing stored', null],
    ['not JSON', '{oops'],
    ['not an object', '"meaning"'],
    ['an unknown mode', JSON.stringify({ ...valid, study_mode: 'typing' })],
    ['an unknown direction', JSON.stringify({ ...valid, conversion_direction: 'sideways' })],
    ['an unknown visibility', JSON.stringify({ ...valid, meaning_visibility: 'audio' })],
  ])('returns null for %s', (_label, raw) => {
    expect(parseStudySettings(raw)).toBeNull()
  })
})
