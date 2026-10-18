import { statusLine } from './statusLine'

const now = new Date('2026-10-18T12:00:00.000Z')
const base = {
  online: true,
  syncing: false,
  failed: false,
  lastSyncedAt: '2026-10-18T11:58:00.000Z',
  pendingAnswers: 0,
  now,
}

test.each([
  [{ online: false }, 'Offline'],
  [{ online: false, pendingAnswers: 3 }, 'Offline · 3 answers waiting to sync'],
  [{ online: false, pendingAnswers: 1 }, 'Offline · 1 answer waiting to sync'],
  [{ syncing: true, pendingAnswers: 2 }, 'Syncing…'],
  [{ pendingAnswers: 2 }, '2 answers waiting to sync'],
  [{ failed: true }, "Couldn't sync. Pull down to try again."],
  [{ lastSyncedAt: '2026-10-18T11:59:40.000Z' }, 'Synced just now'],
  [{}, 'Synced 2 min ago'],
  [{ lastSyncedAt: '2026-10-18T09:00:00.000Z' }, 'Synced 3 h ago'],
  [{ lastSyncedAt: '2026-10-15T12:00:00.000Z' }, 'Synced 3 days ago'],
  [{ lastSyncedAt: '2026-10-17T11:00:00.000Z' }, 'Synced 1 day ago'],
  [{ lastSyncedAt: null }, 'Not synced yet'],
])('%o → %s', (overrides, expected) => {
  expect(statusLine({ ...base, ...overrides })).toBe(expected)
})
