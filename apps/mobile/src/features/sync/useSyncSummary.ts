import { onlineManager } from '@tanstack/react-query'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { outbox, syncEngine } from './instances'

const subscribeOnline = (listener: () => void) => onlineManager.subscribe(listener)

/** Live sync state for the status line, the offline icon and its details sheet. */
export function useSyncSummary() {
  const status = useSyncExternalStore(syncEngine.subscribe, syncEngine.getStatus)
  const queue = useSyncExternalStore(outbox.subscribe, outbox.getState)
  const online = useSyncExternalStore(subscribeOnline, () => onlineManager.isOnline())
  // Re-render every 30 s so "2 min ago" keeps up.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return {
    online,
    syncing: status.syncing,
    failed: status.failed,
    lastSyncedAt: status.lastSyncedAt,
    pendingAnswers: queue.pending.filter((op) => op.type === 'createQuizAttempt').length,
    now,
  }
}
