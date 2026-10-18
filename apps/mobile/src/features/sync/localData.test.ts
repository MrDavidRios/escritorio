import { createLocalData } from './localData'

function setup(owner: string | null) {
  const data = new Map<string, string>(owner ? [['escritorio-local-owner', owner]] : [])
  const deps = {
    storage: {
      getItem: async (key: string) => data.get(key) ?? null,
      setItem: async (key: string, value: string) => void data.set(key, value),
      removeItem: async (key: string) => void data.delete(key),
    },
    clearCache: jest.fn(),
    clearImages: jest.fn(async () => {}),
    clearOutbox: jest.fn(async () => 2),
    clearSyncStatus: jest.fn(async () => {}),
  }
  return { localData: createLocalData(deps), deps, data }
}

test('the same user signing back in keeps everything, including queued results', async () => {
  const { localData, deps } = setup('u1')
  expect(await localData.claim('u1')).toEqual({ discarded: 0 })
  expect(deps.clearOutbox).not.toHaveBeenCalled()
  expect(deps.clearCache).not.toHaveBeenCalled()
})

test("a different user signing in wipes the previous user's data first", async () => {
  const { localData, deps, data } = setup('u1')
  expect(await localData.claim('u2')).toEqual({ discarded: 2 })
  expect(deps.clearCache).toHaveBeenCalled()
  expect(deps.clearImages).toHaveBeenCalled()
  expect(deps.clearOutbox).toHaveBeenCalled()
  expect(deps.clearSyncStatus).toHaveBeenCalled()
  expect(data.get('escritorio-local-owner')).toBe('u2')
})

test('the first sign-in on this phone just records the owner', async () => {
  const { localData, deps, data } = setup(null)
  expect(await localData.claim('u1')).toEqual({ discarded: 0 })
  expect(deps.clearOutbox).not.toHaveBeenCalled()
  expect(data.get('escritorio-local-owner')).toBe('u1')
})

test('wipe clears everything and forgets the owner', async () => {
  const { localData, deps, data } = setup('u1')
  expect(await localData.wipe()).toBe(2)
  expect(deps.clearCache).toHaveBeenCalled()
  expect(data.has('escritorio-local-owner')).toBe(false)
})
