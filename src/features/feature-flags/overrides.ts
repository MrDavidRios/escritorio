import { useSyncExternalStore } from 'react'
import { parseOverrides, type FeatureFlag, type FlagOverrides } from './flags'

// Local overrides exist only in dev builds. In production every function
// here is a no-op and flags come solely from the database.

const STORAGE_KEY = 'escritorio:feature-flag-overrides'
const NO_OVERRIDES: FlagOverrides = {}

let snapshot: FlagOverrides | null = null
const listeners = new Set<() => void>()

function read(): FlagOverrides {
  if (!import.meta.env.DEV) return NO_OVERRIDES
  if (!snapshot) {
    try {
      snapshot = parseOverrides(localStorage.getItem(STORAGE_KEY))
    } catch {
      snapshot = NO_OVERRIDES
    }
  }
  return snapshot
}

function notify() {
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return
  snapshot = null
  notify()
}

function subscribe(listener: () => void) {
  if (!import.meta.env.DEV) return () => {}
  if (listeners.size === 0) window.addEventListener('storage', onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

/** Sets a dev override for a flag; null goes back to the database value. */
export function setFlagOverride(flag: FeatureFlag, value: boolean | null) {
  if (!import.meta.env.DEV) return
  const next = { ...read() }
  if (value === null) delete next[flag]
  else next[flag] = value
  snapshot = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage blocked: the override still applies until reload.
  }
  notify()
}

export function useFlagOverrides(): FlagOverrides {
  return useSyncExternalStore(subscribe, read)
}
