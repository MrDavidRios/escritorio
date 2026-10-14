import { z } from 'zod'

export const phraseSchema = z.object({
  spanish: z
    .string()
    .trim()
    .min(1, 'Enter the Spanish phrase')
    .max(200, 'Keep it under 200 characters'),
  english: z
    .string()
    .trim()
    .min(1, 'Enter the English meaning')
    .max(300, 'Keep it under 300 characters'),
  example: z.string().trim().max(500, 'Keep it under 500 characters'),
})

export type PhraseFormValues = z.infer<typeof phraseSchema>
