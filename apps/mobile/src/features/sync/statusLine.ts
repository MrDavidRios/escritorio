const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function ago(at: string, now: Date): string {
  const elapsed = now.getTime() - Date.parse(at)
  if (elapsed < MINUTE) return 'just now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`
  return `${plural(Math.floor(elapsed / DAY), 'day')} ago`
}

/** The one-line sync summary at the top of the set list. */
export function statusLine({
  online,
  syncing,
  failed,
  lastSyncedAt,
  pendingAnswers,
  now,
}: {
  online: boolean
  syncing: boolean
  failed: boolean
  lastSyncedAt: string | null
  pendingAnswers: number
  now: Date
}): string {
  const waiting = `${plural(pendingAnswers, 'answer')} waiting to sync`
  if (!online) return pendingAnswers > 0 ? `Offline · ${waiting}` : 'Offline'
  if (syncing) return 'Syncing…'
  if (pendingAnswers > 0) return waiting
  if (failed) return "Couldn't sync. Pull down to try again."
  if (!lastSyncedAt) return 'Not synced yet'
  return `Synced ${ago(lastSyncedAt, now)}`
}
