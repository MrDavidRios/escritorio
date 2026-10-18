import { createImageStore, fileNameFor, planImageSync, type ImageFiles } from './imageStore'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => void data.set(key, value),
    removeItem: async (key: string) => void data.delete(key),
  }
}

function fakeFiles(failFor: string[] = []) {
  const names = new Set<string>()
  let inFlight = 0
  let maxInFlight = 0
  const files: ImageFiles = {
    async download(url, name) {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 0))
      inFlight -= 1
      if (failFor.some((p) => url.includes(p))) throw new Error('download failed')
      names.add(name)
    },
    remove: (name) => void names.delete(name),
    list: () => [...names],
    uriFor: (name) => `file:///images/${name}`,
    removeAll: () => names.clear(),
  }
  return { files, names, maxInFlight: () => maxInFlight }
}

function fakeApi(versions: Record<string, string>) {
  return {
    listImageVersions: jest.fn(async () => versions),
    getSignedImageUrls: jest.fn(async (paths: string[]) =>
      Object.fromEntries(paths.map((p) => [p, `https://cdn.test/${p}`])),
    ),
  }
}

const T1 = '2026-10-01T00:00:00.000Z'
const T2 = '2026-10-05T00:00:00.000Z'

describe('planImageSync', () => {
  const manifest = {
    'u/a.png': { updatedAt: T1, file: 'a' },
    'u/b.png': { updatedAt: T1, file: 'b' },
    'u/old.png': { updatedAt: T1, file: 'old' },
  }
  const remote = { 'u/a.png': T1, 'u/b.png': T2, 'u/new.png': T1, 'u/old.png': T1 }

  it('downloads missing and changed images, removes unwanted ones', () => {
    expect(
      planImageSync(['u/a.png', 'u/b.png', 'u/new.png', 'u/gone.png'], remote, manifest),
    ).toEqual({
      download: ['u/b.png', 'u/new.png'],
      remove: ['u/old.png'],
    })
  })
})

test('a new file name per version, keeping the extension', () => {
  expect(fileNameFor('u1/sets/s1.png', T2)).toBe(`u1_sets_s1-${Date.parse(T2)}.png`)
})

test('mirrors wanted images, four downloads at a time, and serves local URIs', async () => {
  const paths = Array.from({ length: 10 }, (_, i) => `u1/c${i}.png`)
  const { files, maxInFlight } = fakeFiles()
  const api = fakeApi(Object.fromEntries(paths.map((p) => [p, T1])))
  const store = createImageStore({ files, api, storage: memoryStorage() })

  await store.sync(paths, 'u1')

  expect(api.listImageVersions).toHaveBeenCalledWith('u1')
  expect(api.getSignedImageUrls).toHaveBeenCalledTimes(1)
  expect(maxInFlight()).toBe(4)
  expect(store.uriFor('u1/c3.png')).toBe(`file:///images/${fileNameFor('u1/c3.png', T1)}`)
})

test('a replaced image is downloaded under a new name and the old file is deleted', async () => {
  const { files, names } = fakeFiles()
  const storage = memoryStorage()
  await createImageStore({ files, api: fakeApi({ 'u1/c1.png': T1 }), storage }).sync(
    ['u1/c1.png'],
    'u1',
  )

  const store = createImageStore({ files, api: fakeApi({ 'u1/c1.png': T2 }), storage })
  await store.load()
  await store.sync(['u1/c1.png'], 'u1')

  expect([...names]).toEqual([fileNameFor('u1/c1.png', T2)])
  expect(store.uriFor('u1/c1.png')).toContain(String(Date.parse(T2)))
})

test('images no longer wanted are deleted, and unchanged ones are left alone', async () => {
  const { files, names } = fakeFiles()
  const storage = memoryStorage()
  const api = fakeApi({ 'u1/a.png': T1, 'u1/b.png': T1 })
  const store = createImageStore({ files, api, storage })
  await store.sync(['u1/a.png', 'u1/b.png'], 'u1')

  await store.sync(['u1/a.png'], 'u1')

  expect([...names]).toEqual([fileNameFor('u1/a.png', T1)])
  expect(store.uriFor('u1/b.png')).toBeNull()
  expect(api.getSignedImageUrls).toHaveBeenCalledTimes(1)
})

test('a failed download shows no image, the others still land, and it is retried next sync', async () => {
  const { files } = fakeFiles(['u1/bad.png'])
  const api = fakeApi({ 'u1/bad.png': T1, 'u1/good.png': T1 })
  const store = createImageStore({ files, api, storage: memoryStorage(), onError: jest.fn() })

  await store.sync(['u1/bad.png', 'u1/good.png'], 'u1')
  expect(store.uriFor('u1/bad.png')).toBeNull()
  expect(store.uriFor('u1/good.png')).not.toBeNull()

  await store.sync(['u1/bad.png', 'u1/good.png'], 'u1')
  expect(api.getSignedImageUrls).toHaveBeenLastCalledWith(['u1/bad.png'])
})

test('with no sets there is no owner: nothing is listed and old files are removed', async () => {
  const { files, names } = fakeFiles()
  const storage = memoryStorage()
  await createImageStore({ files, api: fakeApi({ 'u1/a.png': T1 }), storage }).sync(
    ['u1/a.png'],
    'u1',
  )
  const api = fakeApi({})
  const store = createImageStore({ files, api, storage })
  await store.load()

  await store.sync([], null)

  expect(api.listImageVersions).not.toHaveBeenCalled()
  expect(names.size).toBe(0)
})

test('files left over from an interrupted sync are cleaned up', async () => {
  const { files, names } = fakeFiles()
  names.add('stray-123.png')
  const store = createImageStore({ files, api: fakeApi({}), storage: memoryStorage() })
  await store.sync([], 'u1')
  expect(names.has('stray-123.png')).toBe(false)
})

test('each finished download is remembered, even if the sync never completes', async () => {
  const names = new Set<string>()
  let releaseSlow: () => void = () => {}
  const files: ImageFiles = {
    download: async (url, name) => {
      if (url.includes('slow')) await new Promise<void>((resolve) => (releaseSlow = resolve))
      names.add(name)
    },
    remove: (name) => void names.delete(name),
    list: () => [...names],
    uriFor: (name) => `file:///images/${name}`,
    removeAll: () => names.clear(),
  }
  const storage = memoryStorage()
  const api = fakeApi({ 'u1/fast.png': T1, 'u1/slow.png': T1 })
  void createImageStore({ files, api, storage }).sync(['u1/fast.png', 'u1/slow.png'], 'u1')
  await new Promise((resolve) => setTimeout(resolve, 0))

  // The app is closed here; a relaunch reads what was saved.
  const relaunched = createImageStore({ files, api, storage })
  await relaunched.load()
  expect(relaunched.uriFor('u1/fast.png')).not.toBeNull()
  releaseSlow()
})

test('a sync that was in flight when the store was cleared leaves nothing behind', async () => {
  const names = new Set<string>()
  let release: () => void = () => {}
  const files: ImageFiles = {
    download: async (_url, name) => {
      await new Promise<void>((resolve) => (release = resolve))
      names.add(name)
    },
    remove: (name) => void names.delete(name),
    list: () => [...names],
    uriFor: (name) => `file:///images/${name}`,
    removeAll: () => names.clear(),
  }
  const storage = memoryStorage()
  const store = createImageStore({ files, api: fakeApi({ 'u1/a.png': T1 }), storage })
  const syncing = store.sync(['u1/a.png'], 'u1')
  await new Promise((resolve) => setTimeout(resolve, 0))

  await store.clear()
  release()
  await syncing

  expect(names.size).toBe(0)
  expect(store.uriFor('u1/a.png')).toBeNull()
  expect(storage.data.size).toBe(0)
})

test('clear deletes every file and forgets the manifest', async () => {
  const { files, names } = fakeFiles()
  const storage = memoryStorage()
  const store = createImageStore({ files, api: fakeApi({ 'u1/a.png': T1 }), storage })
  await store.sync(['u1/a.png'], 'u1')

  await store.clear()

  expect(names.size).toBe(0)
  expect(store.uriFor('u1/a.png')).toBeNull()
  expect(storage.data.size).toBe(0)
})

test('subscribers hear about each downloaded image', async () => {
  const { files } = fakeFiles()
  const store = createImageStore({
    files,
    api: fakeApi({ 'u1/a.png': T1, 'u1/b.png': T1 }),
    storage: memoryStorage(),
  })
  const listener = jest.fn()
  store.subscribe(listener)
  await store.sync(['u1/a.png', 'u1/b.png'], 'u1')
  expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2)
})
