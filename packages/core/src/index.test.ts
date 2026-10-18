import { describe, expect, it } from 'vitest'
import * as core from './index'

// The web app (and later the mobile app) imports only from the barrel.
// If a re-export goes missing, this fails here rather than as a
// confusing build error in an app.
describe('@escritorio/core barrel', () => {
  it.each([
    'isAnswerCorrect',
    'normalizeAnswer',
    'isCardEligible',
    'eligibleCards',
    'buildQuestion',
    'exclusionReason',
    'studyModeLabel',
    'configFromFields',
    'configFromStudySet',
    'noEligibleCardsMessage',
    'fetchEnglishDefinition',
    'fetchSpanishDefinition',
    'manualLookupLinks',
    'queryKeys',
    'cardSchema',
    'hasRequiredContent',
    'REQUIRED_CONTENT_MESSAGE',
    'studySetSchema',
    'authSchema',
    'createApi',
    'cardImagePath',
    'studySetImagePath',
    'SIGNED_URL_STALE_TIME_MS',
  ])('exports %s', (name) => {
    expect(core).toHaveProperty(name)
  })
})
