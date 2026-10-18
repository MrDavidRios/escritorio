import type { KeyValueStorage } from './outbox'

const OWNER_KEY = 'escritorio-local-owner'

/**
 * Everything cached on the phone (sets, cards, images, queued results)
 * belongs to one user. A session that ends on its own keeps it for that
 * user; a different user signing in, or an explicit sign-out, wipes it.
 */
export function createLocalData({
  storage,
  clearCache,
  clearImages,
  clearOutbox,
  clearSyncStatus,
}: {
  storage: KeyValueStorage
  clearCache: () => void
  clearImages: () => Promise<void>
  clearOutbox: () => Promise<number>
  clearSyncStatus: () => Promise<void>
}) {
  async function clearAll(): Promise<number> {
    clearCache()
    const [discarded] = await Promise.all([clearOutbox(), clearImages(), clearSyncStatus()])
    return discarded
  }

  return {
    /** Resolves to how many unsent results of a previous user were discarded. */
    async claim(userId: string): Promise<{ discarded: number }> {
      const owner = await storage.getItem(OWNER_KEY)
      const discarded = owner && owner !== userId ? await clearAll() : 0
      await storage.setItem(OWNER_KEY, userId)
      return { discarded }
    },
    async wipe(): Promise<number> {
      const discarded = await clearAll()
      await storage.removeItem(OWNER_KEY)
      return discarded
    },
  }
}
