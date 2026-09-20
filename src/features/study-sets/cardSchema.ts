import { z } from 'zod'

export const cardSchema = z.object({
  hint: z.string().trim(),
  english_equivalent: z.string().trim(),
  definition: z.string().trim(),
  spanish_term: z.string().trim().min(1, 'Spanish term is required'),
})

export type CardFormValues = z.infer<typeof cardSchema>
