import { api } from '@/lib/api'
import { createStudyWriter } from './createStudyWriter'

export const studyWriter = createStudyWriter(api)
