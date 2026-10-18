import { createSyncEngine, type SyncedData } from './syncEngine'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => void data.set(key, value),
    removeItem: async (key: string) => void data.delete(key),
  }
}

const DATA: SyncedData = { sets: [], cards: [] }

function setup({ online = true } = {}) {
  const log: string[] = []
  let release: () => void = () => {}
  const deps = {
    isOnline: jest.fn(() => online),
    flushOutbox: jest.fn(async (): Promise<void> => {
      log.push('outbox')
    }),
    fetchData: jest.fn(async () => {
      log.push('fetch')
      return DATA
    }),
    applyData: jest.fn(() => void log.push('apply')),
    syncImages: jest.fn(async () => void log.push('images')),
    storage: memoryStorage(),
    now: () => new Date('2026-10-18T12:00:00.000Z'),
    onError: jest.fn(),
  }
  const gate = () =>
    new Promise<void>((resolve) => {
      release = resolve
    })
  return { engine: createSyncEngine(deps), deps, log, gate, release: () => release() }
}

test('a run sends the outbox, then refreshes data, then images', async () => {
  const { engine, log, deps } = setup()
  await engine.requestSync()
  expect(log).toEqual(['outbox', 'fetch', 'apply', 'images'])
  expect(deps.applyData).toHaveBeenCalledWith(DATA)
  expect(deps.syncImages).toHaveBeenCalledWith(DATA)
  expect(engine.getStatus()).toEqual({
    syncing: false,
    lastSyncedAt: '2026-10-18T12:00:00.000Z',
    failed: false,
  })
})

test('offline, a sync does nothing', async () => {
  const { engine, log } = setup({ online: false })
  await engine.requestSync()
  expect(log).toEqual([])
})

test('triggers during a run merge into one follow-up run', async () => {
  const { engine, deps, gate, release } = setup()
  deps.flushOutbox.mockImplementationOnce(gate)

  const first = engine.requestSync()
  expect(engine.getStatus().syncing).toBe(true)
  const second = engine.requestSync()
  const third = engine.requestSync()
  expect(second).toBe(third)

  release()
  await Promise.all([first, second, third])
  expect(deps.fetchData).toHaveBeenCalledTimes(2)
})

test('a failed run keeps the last sync time and reports the failure', async () => {
  const { engine, deps } = setup()
  await engine.requestSync()
  deps.fetchData.mockRejectedValueOnce(new Error('offline'))

  await engine.requestSync()

  expect(engine.getStatus()).toEqual({
    syncing: false,
    lastSyncedAt: '2026-10-18T12:00:00.000Z',
    failed: true,
  })
  expect(deps.onError).toHaveBeenCalled()
})

test('the last sync time survives a restart, and clear forgets it', async () => {
  const { engine, deps } = setup()
  await engine.requestSync()

  const relaunched = createSyncEngine(deps)
  await relaunched.load()
  expect(relaunched.getStatus().lastSyncedAt).toBe('2026-10-18T12:00:00.000Z')

  await relaunched.clear()
  expect(relaunched.getStatus().lastSyncedAt).toBeNull()
  expect(deps.storage.data.size).toBe(0)
})
