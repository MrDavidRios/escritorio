import { createLargeSecureStore, type DataStore, type KeyStore } from './largeSecureStore'

function memoryStores() {
  const keys = new Map<string, string>()
  const data = new Map<string, string>()
  const keyStore: KeyStore = {
    getItemAsync: async (k) => keys.get(k) ?? null,
    setItemAsync: async (k, v) => void keys.set(k, v),
    deleteItemAsync: async (k) => void keys.delete(k),
  }
  const dataStore: DataStore = {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  }
  return { keys, data, keyStore, dataStore }
}

const SESSION = JSON.stringify({ access_token: 'a'.repeat(3000), user: { id: 'u1' } })

test('round-trips a value larger than the Keychain item limit', async () => {
  const stores = memoryStores()
  const store = createLargeSecureStore(stores)

  await store.setItem('escritorio-auth', SESSION)

  expect(await store.getItem('escritorio-auth')).toBe(SESSION)
})

test('stores only ciphertext in AsyncStorage and only the key in the Keychain', async () => {
  const stores = memoryStores()
  await createLargeSecureStore(stores).setItem('escritorio-auth', SESSION)

  expect(stores.data.get('escritorio-auth')).not.toContain('access_token')
  expect(stores.keys.get('escritorio-auth')).toMatch(/^[0-9a-f]{64}$/)
})

test('returns null when nothing is stored', async () => {
  expect(await createLargeSecureStore(memoryStores()).getItem('escritorio-auth')).toBeNull()
})

test('returns null when the Keychain key is gone but ciphertext remains', async () => {
  const stores = memoryStores()
  const store = createLargeSecureStore(stores)
  await store.setItem('escritorio-auth', SESSION)
  stores.keys.clear()

  expect(await store.getItem('escritorio-auth')).toBeNull()
})

test('returns null when the key does not decrypt the stored data', async () => {
  const stores = memoryStores()
  const store = createLargeSecureStore(stores)
  await store.setItem('escritorio-auth', SESSION)
  stores.keys.set('escritorio-auth', '00'.repeat(32))

  expect(await store.getItem('escritorio-auth')).toBeNull()
})

test('removeItem clears both stores', async () => {
  const stores = memoryStores()
  const store = createLargeSecureStore(stores)
  await store.setItem('escritorio-auth', SESSION)

  await store.removeItem('escritorio-auth')

  expect(stores.data.size).toBe(0)
  expect(stores.keys.size).toBe(0)
})
