import { outbox } from '@/features/sync/instances'
import { createOutboxWriter } from './writer'

export const studyWriter = createOutboxWriter(outbox)
