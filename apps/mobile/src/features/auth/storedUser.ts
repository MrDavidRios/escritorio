import type { SessionStorage } from '@/lib/largeSecureStore'

export interface StoredUser {
  id: string
  email: string | null
}

/**
 * The user from the session auth-js persisted, whether or not its access
 * token is still valid. This is the offline sign-in check: getSession()
 * returns null when the token has expired and can't be refreshed (no
 * network), but the learner is still signed in.
 */
export async function readStoredUser(
  storage: SessionStorage,
  key: string,
): Promise<StoredUser | null> {
  const raw = await storage.getItem(key)
  if (!raw) return null
  try {
    const user = (JSON.parse(raw) as { user?: { id?: string; email?: string | null } }).user
    return user?.id ? { id: user.id, email: user.email ?? null } : null
  } catch {
    return null
  }
}
