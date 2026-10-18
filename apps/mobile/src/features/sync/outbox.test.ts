import { classifyError, createOutbox, type KeyValueStorage, type OutboxOp } from './outbox'

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => void data.set(key, value),
    removeItem: async (key) => void data.delete(key),
  }
}

const pgError = (code: string, message = 'error') => Object.assign(new Error(message), { code })

function fakeApi() {
  const sent: string[] = []
  const api = {
    studySessions: {
      createStudySession: jest.fn(async (input: { id?: string }) => {
        sent.push(`session ${input.id}`)
        return null
      }),
      completeStudySession: jest.fn(async (id: string) => {
        sent.push(`complete ${id}`)
        return {} as never
      }),
    },
    quizAttempts: {
      createQuizAttempt: jest.fn(async (input: { id?: string }) => {
        sent.push(`attempt ${input.id}`)
      }),
    },
  }
  return { api, sent }
}

const session: OutboxOp = {
  type: 'createStudySession',
  id: 'sess-1',
  input: {
    id: 'sess-1',
    started_at: '2026-10-18T10:00:00.000Z',
    study_set_id: 's1',
    mode: 'conversion',
    direction: 'es_en',
    visibility: null,
    deck_size: 2,
  },
}
const attempt = (id: string): OutboxOp => ({
  type: 'createQuizAttempt',
  id,
  input: {
    id,
    answered_at: '2026-10-18T10:01:00.000Z',
    card_id: 'c1',
    is_correct: true,
    attempt_count: 1,
    session_id: 'sess-1',
    resolved_direction: 'es_en',
  },
})
const complete: OutboxOp = {
  type: 'completeStudySession',
  id: 'sess-1',
  patch: { completed_at: '2026-10-18T10:05:00.000Z', cards_correct: 1 },
}

function setup(overrides: Partial<Parameters<typeof createOutbox>[0]> = {}) {
  const { api, sent } = fakeApi()
  const storage = memoryStorage()
  const timers: { fn: () => void; ms: number }[] = []
  const deps = {
    api,
    storage,
    refreshAuth: jest.fn(async () => 'refreshed' as const),
    schedule: (fn: () => void, ms: number) => void timers.push({ fn, ms }),
    now: () => new Date('2026-10-18T12:00:00.000Z'),
    onError: jest.fn(),
    ...overrides,
  }
  return { outbox: createOutbox(deps), api, sent, storage, timers, deps }
}

const stored = (storage: { data: Map<string, string> }) =>
  JSON.parse(storage.data.get('escritorio-outbox') ?? '{"pending":[],"failed":[]}')

test('sends ops one at a time, oldest first, and empties the stored queue', async () => {
  const { outbox, sent, storage } = setup()
  await outbox.enqueue(session)
  await outbox.enqueue(attempt('a1'))
  await outbox.enqueue(complete)
  expect(stored(storage).pending).toHaveLength(3)

  await outbox.flush()

  expect(sent).toEqual(['session sess-1', 'attempt a1', 'complete sess-1'])
  expect(outbox.getState().pending).toEqual([])
  expect(stored(storage).pending).toEqual([])
})

test('queued ops survive an app restart', async () => {
  const first = setup()
  await first.outbox.enqueue(attempt('a1'))

  const { api, sent } = fakeApi()
  const relaunched = createOutbox({ ...first.deps, api, storage: first.storage })
  await relaunched.flush()

  expect(sent).toEqual(['attempt a1'])
})

test('a network error stops sending, keeps the queue and retries with backoff', async () => {
  const { outbox, api, sent, timers } = setup()
  api.quizAttempts.createQuizAttempt
    .mockRejectedValueOnce(pgError('', 'TypeError: Network request failed'))
    .mockRejectedValueOnce(pgError('', 'TypeError: Network request failed'))
  await outbox.enqueue(attempt('a1'))
  await outbox.enqueue(attempt('a2'))

  await outbox.flush()
  expect(sent).toEqual([])
  expect(outbox.getState().pending).toHaveLength(2)
  expect(timers.map((t) => t.ms)).toEqual([5_000])

  timers[0].fn()
  await outbox.flush()
  expect(timers.map((t) => t.ms)).toEqual([5_000, 10_000])

  await outbox.flush()
  // The retried op keeps its id, so the server's upsert can't double it.
  expect(sent).toEqual(['attempt a1', 'attempt a2'])
  expect(api.quizAttempts.createQuizAttempt.mock.calls.map(([input]) => input.id)).toEqual([
    'a1',
    'a1',
    'a1',
    'a2',
  ])
})

test('an op the server already has (23505) counts as sent', async () => {
  const { outbox, api } = setup()
  api.quizAttempts.createQuizAttempt.mockRejectedValueOnce(pgError('23505', 'duplicate key'))
  await outbox.enqueue(attempt('a1'))
  await outbox.flush()
  expect(outbox.getState()).toMatchObject({ pending: [], failed: [] })
})

test('a rejected op moves to the "couldn\'t sync" list and the rest still go', async () => {
  const { outbox, api, sent, storage } = setup()
  api.quizAttempts.createQuizAttempt.mockRejectedValueOnce(pgError('P0001', 'card does not exist'))
  await outbox.enqueue(attempt('a1'))
  await outbox.enqueue(complete)

  await outbox.flush()

  expect(sent).toEqual(['complete sess-1'])
  expect(outbox.getState().failed).toEqual([
    { op: attempt('a1'), error: 'card does not exist', failedAt: '2026-10-18T12:00:00.000Z' },
  ])
  expect(stored(storage).failed).toHaveLength(1)
})

test('an auth error refreshes the token and retries the op', async () => {
  const { outbox, api, sent, deps } = setup()
  api.quizAttempts.createQuizAttempt.mockRejectedValueOnce(pgError('PGRST303', 'JWT expired'))
  await outbox.enqueue(attempt('a1'))
  await outbox.flush()
  expect(deps.refreshAuth).toHaveBeenCalledTimes(1)
  expect(sent).toEqual(['attempt a1'])
})

test('a rejected refresh pauses the outbox until resume, keeping the op', async () => {
  const { outbox, api, sent } = setup({ refreshAuth: jest.fn(async () => 'rejected' as const) })
  api.quizAttempts.createQuizAttempt.mockRejectedValueOnce(pgError('PGRST303', 'JWT expired'))
  await outbox.enqueue(attempt('a1'))

  await outbox.flush()
  expect(outbox.getState()).toMatchObject({ paused: true, pending: [attempt('a1')] })
  await outbox.flush()
  expect(sent).toEqual([])

  await outbox.resume()
  await outbox.flush()
  expect(sent).toEqual(['attempt a1'])
})

test('a refresh that fails offline is retried later, not a pause', async () => {
  const { outbox, api, timers } = setup({ refreshAuth: jest.fn(async () => 'offline' as const) })
  api.quizAttempts.createQuizAttempt.mockRejectedValueOnce(pgError('PGRST303', 'JWT expired'))
  await outbox.enqueue(attempt('a1'))
  await outbox.flush()
  expect(outbox.getState().paused).toBe(false)
  expect(timers).toHaveLength(1)
})

test('a second auth error after a refresh pauses instead of looping', async () => {
  const { outbox, api, deps } = setup()
  api.quizAttempts.createQuizAttempt.mockRejectedValue(pgError('PGRST301', 'JWT invalid'))
  await outbox.enqueue(attempt('a1'))
  await outbox.flush()
  expect(deps.refreshAuth).toHaveBeenCalledTimes(1)
  expect(outbox.getState().paused).toBe(true)
})

test("without the phone owner's session, nothing is sent and the queue waits", async () => {
  let signedIn = false
  const { outbox, sent } = setup({ canSend: async () => signedIn })
  await outbox.enqueue(attempt('a1'))

  await outbox.flush()
  expect(sent).toEqual([])
  expect(outbox.getState()).toMatchObject({ paused: true, pending: [attempt('a1')], failed: [] })

  signedIn = true
  await outbox.resume()
  await outbox.flush()
  expect(sent).toEqual(['attempt a1'])
})

test('a new answer is saved to the phone even while a send is hanging', async () => {
  const { outbox, api, sent, storage } = setup()
  let release: () => void = () => {}
  api.quizAttempts.createQuizAttempt.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = () => {
          sent.push('attempt a1')
          resolve()
        }
      }),
  )
  await outbox.enqueue(attempt('a1'))
  const flushing = outbox.flush()
  await new Promise((resolve) => setTimeout(resolve, 0))

  await outbox.enqueue(attempt('a2'))
  expect(outbox.getState().pending).toHaveLength(2)
  expect(stored(storage).pending).toHaveLength(2)

  release()
  await flushing
  await outbox.flush()
  expect(sent).toEqual(['attempt a1', 'attempt a2'])
  expect(outbox.getState().pending).toEqual([])
})

test('clear drops everything and reports how many unsent ops were discarded', async () => {
  const { outbox, storage } = setup()
  await outbox.enqueue(attempt('a1'))
  await outbox.enqueue(attempt('a2'))
  expect(await outbox.clear()).toBe(2)
  expect(outbox.getState()).toEqual({ pending: [], failed: [], paused: false })
  expect(storage.data.has('escritorio-outbox')).toBe(false)
})

test('subscribers hear about every change', async () => {
  const { outbox } = setup()
  const listener = jest.fn()
  outbox.subscribe(listener)
  await outbox.enqueue(attempt('a1'))
  await outbox.flush()
  expect(listener).toHaveBeenCalledTimes(2)
})

test.each([
  [pgError('', 'TypeError: Network request failed'), 'transient'],
  [new TypeError('Network request failed'), 'transient'],
  [pgError('PGRST000'), 'transient'],
  [pgError('57014'), 'transient'],
  [pgError('PGRST303', 'JWT expired'), 'auth'],
  [pgError('PGRST301'), 'auth'],
  [pgError('23505'), 'duplicate'],
  [pgError('P0001'), 'permanent'],
  [pgError('23503'), 'permanent'],
  [pgError('PGRST116'), 'permanent'],
  // Row-level security rejecting the write: no (or the wrong) session.
  [pgError('42501'), 'auth'],
])('classifies %o as %s', (error, expected) => {
  expect(classifyError(error)).toBe(expected)
})
