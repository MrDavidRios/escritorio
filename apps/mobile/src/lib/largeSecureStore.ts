import AsyncStorage from '@react-native-async-storage/async-storage'
import * as aesjs from 'aes-js'
import * as SecureStore from 'expo-secure-store'

export interface KeyStore {
  getItemAsync(key: string): Promise<string | null>
  setItemAsync(key: string, value: string): Promise<void>
  deleteItemAsync(key: string): Promise<void>
}

export interface DataStore {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export interface SessionStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

const defaultRandomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))

/**
 * Supabase session storage that fits the Keychain's 2 KB item limit: the
 * session is AES-256-CTR encrypted into AsyncStorage, and only the per-write
 * random key lives in the Keychain (Supabase's LargeSecureStore pattern).
 */
export function createLargeSecureStore({
  keyStore = SecureStore,
  dataStore = AsyncStorage,
  randomBytes = defaultRandomBytes,
}: {
  keyStore?: KeyStore
  dataStore?: DataStore
  randomBytes?: (n: number) => Uint8Array
} = {}): SessionStorage {
  function cipher(key: Uint8Array) {
    return new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1))
  }

  return {
    async getItem(name) {
      const encrypted = await dataStore.getItem(name)
      if (!encrypted) return null
      const keyHex = await keyStore.getItemAsync(name)
      // A missing key (or one from a different write) can't decrypt the
      // data. Treat it as no session instead of handing auth-js garbage.
      if (!keyHex) return null
      try {
        const bytes = cipher(aesjs.utils.hex.toBytes(keyHex)).decrypt(
          aesjs.utils.hex.toBytes(encrypted),
        )
        const value = aesjs.utils.utf8.fromBytes(bytes)
        JSON.parse(value)
        return value
      } catch {
        return null
      }
    },

    async setItem(name, value) {
      const key = randomBytes(32)
      const encrypted = cipher(key).encrypt(aesjs.utils.utf8.toBytes(value))
      await keyStore.setItemAsync(name, aesjs.utils.hex.fromBytes(key))
      await dataStore.setItem(name, aesjs.utils.hex.fromBytes(encrypted))
    },

    async removeItem(name) {
      await dataStore.removeItem(name)
      await keyStore.deleteItemAsync(name)
    },
  }
}
