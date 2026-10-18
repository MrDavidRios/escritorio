import type { Api, QuizAttemptInput, StudySessionInput } from '@escritorio/core'

export type OutboxOp =
  | {
      type: 'createStudySession'
      id: string
      input: StudySessionInput & { id: string; started_at: string }
    }
  | {
      type: 'completeStudySession'
      id: string
      patch: { completed_at: string; cards_correct: number }
    }
  | {
      type: 'createQuizAttempt'
      id: string
      input: QuizAttemptInput & { id: string; answered_at: string }
    }

export type FailedOp = { op: OutboxOp; error: string; failedAt: string }
export type OutboxState = { pending: OutboxOp[]; failed: FailedOp[]; paused: boolean }
export type RefreshResult = 'refreshed' | 'offline' | 'rejected'

export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export type OutboxApi = {
  studySessions: Pick<Api['studySessions'], 'createStudySession' | 'completeStudySession'>
  quizAttempts: Pick<Api['quizAttempts'], 'createQuizAttempt'>
}

export type Outbox = {
  enqueue(op: OutboxOp): Promise<void>
  /** Sends until the queue is empty, a transient error, or an auth pause. */
  flush(): Promise<void>
  /** After a user signs back in: unpause (the caller then flushes). */
  resume(): Promise<void>
  /** Drops pending and failed ops; resolves to how many pending ops were discarded. */
  clear(): Promise<number>
  getState(): OutboxState
  subscribe(listener: () => void): () => void
}

const STORAGE_KEY = 'escritorio-outbox'
const BASE_RETRY_MS = 5_000
const MAX_RETRY_MS = 5 * 60_000

const AUTH_CODES = new Set(['PGRST301', 'PGRST302', 'PGRST303'])
// Connection, rollback, resource, operator-intervention, system and internal errors.
const TRANSIENT_SQLSTATE = /^(08|40|53|57|58|XX)/

/**
 * Core throws the PostgREST error object, which carries a code but no HTTP
 * status. An empty code is a network failure (or a non-JSON 5xx page).
 */
export function classifyError(error: unknown): 'transient' | 'auth' | 'permanent' | 'duplicate' {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown }
  const c = typeof code === 'string' ? code : ''
  if (c === '23505') return 'duplicate'
  if (AUTH_CODES.has(c) || /jwt/i.test(String(message ?? ''))) return 'auth'
  if (c === '' || c.startsWith('PGRST00') || TRANSIENT_SQLSTATE.test(c)) return 'transient'
  return 'permanent'
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * The persisted FIFO queue of study writes. Ops are sent one at a time
 * because an attempt's session_id references its session. Every write
 * carries a client id, so re-sending after a lost response is a no-op on
 * the server (upsert ignoreDuplicates).
 */
export function createOutbox({
  api,
  storage,
  refreshAuth,
  schedule = (fn, ms) => void setTimeout(fn, ms),
  now = () => new Date(),
  onError = (error) => console.error('Outbox storage failed:', error),
}: {
  api: OutboxApi
  storage: KeyValueStorage
  refreshAuth: () => Promise<RefreshResult>
  schedule?: (fn: () => void, ms: number) => void
  now?: () => Date
  onError?: (error: unknown) => void
}): Outbox {
  let state: OutboxState = { pending: [], failed: [], paused: false }
  const listeners = new Set<() => void>()
  let failures = 0
  let retryScheduled = false

  function set(next: OutboxState) {
    state = next
    listeners.forEach((listener) => listener())
  }

  async function save() {
    try {
      await storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ pending: state.pending, failed: state.failed }),
      )
    } catch (error) {
      onError(error)
    }
  }

  async function load() {
    try {
      const raw = await storage.getItem(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Partial<OutboxState>
      set({ ...state, pending: saved.pending ?? [], failed: saved.failed ?? [] })
    } catch (error) {
      onError(error)
    }
  }

  // Every read-modify-write runs in order on one chain, starting with load.
  let tail: Promise<unknown> = load()
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task)
    tail = result.catch(() => {})
    return result
  }

  function send(op: OutboxOp): Promise<unknown> {
    switch (op.type) {
      case 'createStudySession':
        return api.studySessions.createStudySession(op.input)
      case 'completeStudySession':
        return api.studySessions.completeStudySession(op.id, op.patch)
      case 'createQuizAttempt':
        return api.quizAttempts.createQuizAttempt(op.input)
    }
  }

  function scheduleRetry() {
    failures += 1
    if (retryScheduled) return
    retryScheduled = true
    const delay = Math.min(BASE_RETRY_MS * 2 ** (failures - 1), MAX_RETRY_MS)
    schedule(() => {
      retryScheduled = false
      void flush()
    }, delay)
  }

  async function sendAll() {
    let refreshedFor: OutboxOp | null = null
    while (!state.paused && state.pending.length > 0) {
      const op = state.pending[0]
      try {
        await send(op)
      } catch (error) {
        const kind = classifyError(error)
        if (kind === 'transient') return scheduleRetry()
        if (kind === 'auth') {
          if (refreshedFor !== op) {
            const result = await refreshAuth()
            if (result === 'refreshed') {
              refreshedFor = op
              continue
            }
            if (result === 'offline') return scheduleRetry()
          }
          set({ ...state, paused: true })
          return
        }
        if (kind === 'permanent') {
          set({
            ...state,
            pending: state.pending.slice(1),
            failed: [
              ...state.failed,
              { op, error: messageOf(error), failedAt: now().toISOString() },
            ],
          })
          await save()
          continue
        }
        // 'duplicate': the server already has it.
      }
      failures = 0
      set({ ...state, pending: state.pending.slice(1) })
      await save()
    }
  }

  function flush() {
    return serial(sendAll)
  }

  return {
    enqueue: (op) =>
      serial(async () => {
        set({ ...state, pending: [...state.pending, op] })
        await save()
      }),
    flush,
    resume: () =>
      serial(async () => {
        if (state.paused) set({ ...state, paused: false })
      }),
    clear: () =>
      serial(async () => {
        const discarded = state.pending.length
        set({ pending: [], failed: [], paused: false })
        try {
          await storage.removeItem(STORAGE_KEY)
        } catch (error) {
          onError(error)
        }
        return discarded
      }),
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
