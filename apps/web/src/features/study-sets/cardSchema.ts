import { z } from 'zod'

export const cardSchema = z.object({
  hint: z.string().trim(),
  english_equivalent: z.string().trim(),
  definition: z.string().trim(),
  spanish_term: z.string().trim().min(1, 'Spanish term is required'),
})

export type CardFormValues = z.infer<typeof cardSchema>

export const REQUIRED_CONTENT_MESSAGE = 'Add an image, a definition, or an English equivalent'

/**
 * Mirrors the `cards_content_required` DB constraint: a card needs at
 * least one of an image, a definition, or an English equivalent.
 */
export function hasRequiredContent({
  hasImage,
  definition,
  englishEquivalent,
}: {
  hasImage: boolean
  definition: string | null
  englishEquivalent: string | null
}): boolean {
  return hasImage || Boolean(definition?.trim()) || Boolean(englishEquivalent?.trim())
}
