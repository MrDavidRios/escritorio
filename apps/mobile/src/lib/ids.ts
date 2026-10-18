import * as Crypto from 'expo-crypto'

/** A v4 UUID for rows the app creates itself (sessions, attempts). */
export function newId(): string {
  return Crypto.randomUUID()
}
