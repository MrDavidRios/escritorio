import { z } from 'zod'

export const studySetSchema = z.object({
  title: z.string().trim().min(1, 'Title is required'),
  description: z.string().trim(),
})

export type StudySetFormValues = z.infer<typeof studySetSchema>
