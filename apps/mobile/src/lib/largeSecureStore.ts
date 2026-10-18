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
 * session is AES-256-CTR encrypted into AsyncStorage, and only the key lives
 * in the Keychain (Supabase's LargeSecureStore pattern).
 *
 * The key is created once per item and then left alone. Every write stores
 * a fresh random counter block next to its ciphertext (`<counter>:<cipher>`),
 * so a write changes only AsyncStorage: a read in the middle of a write, or a
 * crash between writes, can never pair a new key with old ciphertext.
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
  const { hex, utf8 } = aesjs.utils

  function cipher(key: Uint8Array, counter: Uint8Array) {
    return new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(counter))
  }

  async function keyFor(name: string): Promise<Uint8Array> {
    const existing = await keyStore.getItemAsync(name)
    if (existing) return hex.toBytes(existing)
    const key = randomBytes(32)
    await keyStore.setItemAsync(name, hex.fromBytes(key))
    return key
  }

  return {
    async getItem(name) {
      const stored = await dataStore.getItem(name)
      if (!stored) return null
      const keyHex = await keyStore.getItemAsync(name)
      const [counterHex, encryptedHex] = stored.split(':')
      // A missing key (or one from a different install) can't decrypt the
      // data. Treat it as no session instead of handing auth-js garbage.
      if (!keyHex || !counterHex || !encryptedHex) return null
      try {
        const bytes = cipher(hex.toBytes(keyHex), hex.toBytes(counterHex)).decrypt(
          hex.toBytes(encryptedHex),
        )
        const value = utf8.fromBytes(bytes)
        // auth-js only stores JSON, so a value that doesn't parse means the
        // key didn't match.
        JSON.parse(value)
        return value
      } catch {
        return null
      }
    },

    async setItem(name, value) {
      const key = await keyFor(name)
      const counter = randomBytes(16)
      const encrypted = cipher(key, counter).encrypt(utf8.toBytes(value))
      await dataStore.setItem(name, `${hex.fromBytes(counter)}:${hex.fromBytes(encrypted)}`)
    },

    async removeItem(name) {
      // Data first: a crash in between leaves a key with no data, which reads as no session.
      await dataStore.removeItem(name)
      await keyStore.deleteItemAsync(name)
    },
  }
}
