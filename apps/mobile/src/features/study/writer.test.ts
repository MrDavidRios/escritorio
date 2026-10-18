import type { OutboxOp } from '@/features/sync/outbox'
import { createOutboxWriter } from './writer'

function fakeOutbox() {
  const log: string[] = []
  const outbox = {
    enqueue: jest.fn(async (op: OutboxOp) => void log.push(`enqueue ${op.type} ${op.id}`)),
    flush: jest.fn(async () => void log.push('flush')),
  }
  return { outbox, log }
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

test('queues each study write as an outbox op with its client id, then sends', async () => {
  const { outbox, log } = fakeOutbox()
  const writer = createOutboxWriter(outbox)
  const session = {
    id: 'sess-1',
    started_at: '2026-10-18T10:00:00.000Z',
    study_set_id: 's1',
    mode: 'conversion' as const,
    direction: 'es_en' as const,
    visibility: null,
    deck_size: 1,
  }
  const attempt = {
    id: 'a1',
    answered_at: '2026-10-18T10:01:00.000Z',
    card_id: 'c1',
    is_correct: true,
    attempt_count: 1,
    session_id: 'sess-1',
    resolved_direction: 'es_en' as const,
  }
  const done = { completed_at: '2026-10-18T10:02:00.000Z', cards_correct: 1 }

  writer.startSession(session)
  writer.recordAttempt(attempt)
  writer.completeSession('sess-1', done)
  await flushPromises()

  expect(outbox.enqueue.mock.calls.map(([op]) => op)).toEqual([
    { type: 'createStudySession', id: 'sess-1', input: session },
    { type: 'createQuizAttempt', id: 'a1', input: attempt },
    { type: 'completeStudySession', id: 'sess-1', patch: done },
  ])
  expect(log).toEqual([
    'enqueue createStudySession sess-1',
    'enqueue createQuizAttempt a1',
    'enqueue completeStudySession sess-1',
    'flush',
    'flush',
    'flush',
  ])
})
