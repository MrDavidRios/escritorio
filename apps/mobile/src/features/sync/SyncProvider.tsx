import { useEffect, useState, type ReactNode } from 'react'

export type SyncDeps = {
  claimLocalData: (userId: string) => Promise<{ discarded: number }>
  /** Reads the outbox, image manifest and last sync time from storage. */
  load: () => Promise<void>
  resumeOutbox: () => Promise<void>
  requestSync: () => Promise<void>
  appState: {
    addEventListener(event: 'change', listener: (state: string) => void): { remove(): void }
  }
  subscribeOnline: (listener: (online: boolean) => void) => () => void
  alert: (title: string, message: string) => void
}

/**
 * Signed-in shell for offline sync. Nothing renders until this user owns
 * the local data, so a different user never sees the previous one's sets.
 * Then it syncs at launch, on return to the foreground and on reconnect.
 */
export function SyncProvider({
  userId,
  deps,
  children,
}: {
  userId: string
  deps: SyncDeps
  children: ReactNode
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { discarded } = await deps.claimLocalData(userId)
      await deps.load()
      if (cancelled) return
      if (discarded > 0) {
        deps.alert(
          'Unsynced results removed',
          `${discarded} study result${discarded === 1 ? '' : 's'} from the account that was signed in before hadn't synced. They were removed from this phone.`,
        )
      }
      // A session that ended (refresh token rejected) paused the outbox.
      await deps.resumeOutbox()
      setReady(true)
      void deps.requestSync()
    })()
    return () => {
      cancelled = true
    }
  }, [userId, deps])

  useEffect(() => {
    if (!ready) return
    const appState = deps.appState.addEventListener('change', (state) => {
      if (state === 'active') void deps.requestSync()
    })
    const unsubscribe = deps.subscribeOnline((online) => {
      if (online) void deps.requestSync()
    })
    return () => {
      appState.remove()
      unsubscribe()
    }
  }, [ready, deps])

  return ready ? children : null
}
