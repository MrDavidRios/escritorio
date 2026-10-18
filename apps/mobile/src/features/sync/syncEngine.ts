import type { Card, StudySetSummary } from '@escritorio/core'
import type { KeyValueStorage } from './outbox'

export type SyncedData = { sets: StudySetSummary[]; cards: Card[] }
export type SyncStatus = { syncing: boolean; lastSyncedAt: string | null; failed: boolean }

export type SyncEngine = {
  load(): Promise<void>
  /** Starts a run, or (during one) a single follow-up run shared by every caller. */
  requestSync(): Promise<void>
  getStatus(): SyncStatus
  subscribe(listener: () => void): () => void
  clear(): Promise<void>
}

const LAST_SYNCED_KEY = 'escritorio-last-synced-at'

export function createSyncEngine({
  isOnline,
  flushOutbox,
  fetchData,
  applyData,
  syncImages,
  storage,
  now = () => new Date(),
  onError = (error) => console.warn('Sync failed:', error),
}: {
  isOnline: () => boolean
  flushOutbox: () => Promise<void>
  fetchData: () => Promise<SyncedData>
  applyData: (data: SyncedData) => void
  syncImages: (data: SyncedData) => Promise<void>
  storage: KeyValueStorage
  now?: () => Date
  onError?: (error: unknown) => void
}): SyncEngine {
  let status: SyncStatus = { syncing: false, lastSyncedAt: null, failed: false }
  const listeners = new Set<() => void>()

  function set(patch: Partial<SyncStatus>) {
    status = { ...status, ...patch }
    listeners.forEach((listener) => listener())
  }

  // The order matters: the server gets our writes before we read, so the
  // fresh data already reflects them.
  // Bumped by clear(): a run that started before it (a sign-out mid-sync)
  // must not write the previous user's data back.
  let generation = 0

  async function run() {
    if (!isOnline()) return
    const started = generation
    const stale = () => generation !== started
    set({ syncing: true })
    try {
      await flushOutbox()
      const data = await fetchData()
      if (stale()) return
      applyData(data)
      await syncImages(data)
      if (stale()) return
      const at = now().toISOString()
      set({ lastSyncedAt: at, failed: false })
      await storage.setItem(LAST_SYNCED_KEY, at)
    } catch (error) {
      onError(error)
      set({ failed: true })
    } finally {
      set({ syncing: false })
    }
  }

  let running: Promise<void> | null = null
  let followUp: Promise<void> | null = null

  function requestSync(): Promise<void> {
    if (!running) {
      running = run().finally(() => {
        running = null
      })
      return running
    }
    followUp ??= running.then(() => {
      followUp = null
      return requestSync()
    })
    return followUp
  }

  return {
    async load() {
      try {
        set({ lastSyncedAt: await storage.getItem(LAST_SYNCED_KEY) })
      } catch (error) {
        onError(error)
      }
    },
    requestSync,
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async clear() {
      generation += 1
      set({ lastSyncedAt: null, failed: false })
      await storage.removeItem(LAST_SYNCED_KEY)
    },
  }
}
