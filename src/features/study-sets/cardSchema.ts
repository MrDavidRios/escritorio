import { z } from 'zod'

export const cardSchema = z.object({
  hint: z.string().trim(),
  answer: z.string().trim().min(1, 'Answer is required'),
})

export type CardFormValues = z.infer<typeof cardSchema>
