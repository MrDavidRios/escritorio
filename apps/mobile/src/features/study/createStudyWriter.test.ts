import type { QuizAttemptInput, StudySessionInput } from '@escritorio/core'
import { createStudyWriter } from './createStudyWriter'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function fakeApi() {
  const log: string[] = []
  const api = {
    studySessions: {
      createStudySession: jest.fn(async (input: StudySessionInput) => {
        log.push(`session ${input.id}`)
        return null
      }),
      completeStudySession: jest.fn(
        async (id: string, _patch: { completed_at: string; cards_correct: number }) => {
          log.push(`complete ${id}`)
          return {} as never
        },
      ),
    },
    quizAttempts: {
      createQuizAttempt: jest.fn(async (input: QuizAttemptInput) => {
        log.push(`attempt ${input.id}`)
      }),
    },
  }
  return { api, log }
}

const session = {
  id: 'sess-1',
  started_at: '2026-10-18T10:00:00.000Z',
  study_set_id: 's1',
  mode: 'conversion' as const,
  direction: 'es_en' as const,
  visibility: null,
  deck_size: 2,
}

const attempt = (id: string) => ({
  id,
  answered_at: '2026-10-18T10:01:00.000Z',
  card_id: 'c1',
  is_correct: true,
  attempt_count: 1,
  session_id: 'sess-1',
  resolved_direction: 'es_en' as const,
})

const done = { completed_at: '2026-10-18T10:05:00.000Z', cards_correct: 1 }

test('sends writes one at a time, in the order they were made', async () => {
  const { api, log } = fakeApi()
  const slow = deferred()
  api.studySessions.createStudySession.mockImplementationOnce(async (input) => {
    await slow.promise
    log.push(`session ${input.id}`)
    return null
  })
  const writer = createStudyWriter(api)

  writer.startSession(session)
  writer.recordAttempt(attempt('a1'))
  writer.completeSession('sess-1', done)

  // The session insert is still in flight: the attempt must wait for it,
  // or it would hit the session_id foreign key before the row exists.
  await Promise.resolve()
  await Promise.resolve()
  expect(api.quizAttempts.createQuizAttempt).not.toHaveBeenCalled()

  slow.resolve()
  await writer.idle()
  expect(log).toEqual(['session sess-1', 'attempt a1', 'complete sess-1'])
})

test('passes client ids and timestamps through unchanged', async () => {
  const { api } = fakeApi()
  const writer = createStudyWriter(api)

  writer.startSession(session)
  writer.recordAttempt(attempt('a1'))
  writer.completeSession('sess-1', done)
  await writer.idle()

  expect(api.studySessions.createStudySession).toHaveBeenCalledWith(session)
  expect(api.quizAttempts.createQuizAttempt).toHaveBeenCalledWith(attempt('a1'))
  expect(api.studySessions.completeStudySession).toHaveBeenCalledWith('sess-1', done)
})

test('reports a failed write and keeps sending the rest', async () => {
  const { api, log } = fakeApi()
  const onError = jest.fn()
  const failure = new Error('offline')
  api.studySessions.createStudySession.mockRejectedValueOnce(failure)
  const writer = createStudyWriter(api, onError)

  writer.startSession(session)
  writer.recordAttempt(attempt('a1'))
  await writer.idle()

  expect(onError).toHaveBeenCalledWith(failure)
  expect(log).toEqual(['attempt a1'])
})
