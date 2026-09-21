import type { Card } from '@/types/card'
import type { ConversionDirection, MeaningVisibility, StudySet, StudyMode } from '@/types/studySet'

export type StudyConfig =
  | { mode: 'conversion'; direction: ConversionDirection }
  | { mode: 'meaning'; visibility: MeaningVisibility }

export type Question = {
  card: Card
  /** The word/definition shown to the learner. */
  prompt: string
  expectedAnswer: string
  /** Language the learner is expected to type their answer in. */
  answerLanguage: 'en' | 'es'
  /** The concrete direction this card was asked in -- set only for
   * conversion mode (a fixed value, even under 'random'), null for
   * meaning mode. */
  resolvedDirection: 'en_es' | 'es_en' | null
  showImage: boolean
  showDefinition: boolean
}

function hasText(value: string | null): value is string {
  return value != null && value.trim().length > 0
}

/**
 * Whether a card can be asked at all under the given mode/setting.
 * Meaning-mode 'both' is strict: it requires BOTH image and
 * definition, making it the narrowest deck under meaning mode, not
 * the widest.
 */
export function isCardEligible(card: Card, config: StudyConfig): boolean {
  if (config.mode === 'conversion') {
    return hasText(card.english_equivalent)
  }

  switch (config.visibility) {
    case 'image':
      return hasText(card.image_path)
    case 'definition':
      return hasText(card.definition)
    case 'both':
      return hasText(card.image_path) && hasText(card.definition)
  }
}

export function eligibleCards(cards: Card[], config: StudyConfig): Card[] {
  return cards.filter((card) => isCardEligible(card, config))
}

/** Copy for the per-card exclusion badge; null when the card is eligible. */
export function exclusionReason(card: Card, config: StudyConfig): string | null {
  if (isCardEligible(card, config)) return null

  if (config.mode === 'conversion') {
    return 'No English equivalent'
  }

  const missingImage = !hasText(card.image_path)
  const missingDefinition = !hasText(card.definition)

  if (config.visibility === 'image') return 'No image'
  if (config.visibility === 'definition') return 'No definition'

  // visibility === 'both'
  if (missingImage && missingDefinition) return 'No image or definition'
  if (missingImage) return 'No image'
  return 'No definition'
}

/**
 * Builds the question shown for a single card under the given config.
 * `rng` resolves conversion mode's 'random' direction per card --
 * inject a seeded function in tests for deterministic results. Not
 * used outside conversion mode.
 */
export function buildQuestion(
  card: Card,
  config: StudyConfig,
  rng: () => number = Math.random,
): Question {
  if (config.mode === 'conversion') {
    const direction: 'en_es' | 'es_en' =
      config.direction === 'random' ? (rng() < 0.5 ? 'en_es' : 'es_en') : config.direction

    return direction === 'en_es'
      ? {
          card,
          prompt: card.english_equivalent!,
          expectedAnswer: card.spanish_term,
          answerLanguage: 'es',
          resolvedDirection: 'en_es',
          showImage: false,
          showDefinition: false,
        }
      : {
          card,
          prompt: card.spanish_term,
          expectedAnswer: card.english_equivalent!,
          answerLanguage: 'en',
          resolvedDirection: 'es_en',
          showImage: false,
          showDefinition: false,
        }
  }

  return {
    card,
    prompt: card.spanish_term,
    expectedAnswer: card.spanish_term,
    answerLanguage: 'es',
    resolvedDirection: null,
    showImage: config.visibility === 'image' || config.visibility === 'both',
    showDefinition: config.visibility === 'definition' || config.visibility === 'both',
  }
}

export function studyModeLabel(mode: StudyMode): string {
  return mode === 'conversion' ? 'Word conversion' : 'Definition to word'
}

export function configFromFields(
  fields: Pick<StudySet, 'study_mode' | 'conversion_direction' | 'meaning_visibility'>,
): StudyConfig {
  return fields.study_mode === 'conversion'
    ? { mode: 'conversion', direction: fields.conversion_direction }
    : { mode: 'meaning', visibility: fields.meaning_visibility }
}

export function configFromStudySet(studySet: StudySet): StudyConfig {
  return configFromFields(studySet)
}
