import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { StoredUser } from './storedUser'

export type AuthState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: StoredUser }

export interface AuthLike {
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): {
    data: { subscription: { unsubscribe(): void } }
  }
  signOut(options: { scope: 'local' }): Promise<{ error: Error | null }>
}

const AuthContext = createContext<{ state: AuthState; signOut: () => Promise<void> }>({
  state: { status: 'loading' },
  signOut: async () => {},
})

export function useAuth(): AuthState {
  return useContext(AuthContext).state
}

export function useSignOut(): () => Promise<void> {
  return useContext(AuthContext).signOut
}

/**
 * Signed in = a session is stored on the device (see readStoredUser).
 * After that, only sign-out and explicit auth events change it: SIGNED_OUT
 * comes from a sign-out, or from auth-js rejecting the refresh token online.
 * A null INITIAL_SESSION is ignored, because offline it only means "couldn't
 * refresh yet".
 *
 * onSignedOut runs on every transition from signed in to signed out, so the
 * next user never sees the previous one's cached data.
 */
export function AuthProvider({
  auth,
  readStoredUser,
  clearStoredSession,
  onSignedOut,
  children,
}: {
  auth: AuthLike
  readStoredUser: () => Promise<StoredUser | null>
  clearStoredSession: () => Promise<void>
  onSignedOut?: () => void
  children: ReactNode
}) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    readStoredUser().then((user) => {
      if (cancelled) return
      setState((current) =>
        current.status !== 'loading'
          ? current
          : user
            ? { status: 'signedIn', user }
            : { status: 'signedOut' },
      )
    })

    const { data } = auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setState({ status: 'signedOut' })
      } else if (session?.user && event !== 'INITIAL_SESSION') {
        setState({
          status: 'signedIn',
          user: { id: session.user.id, email: session.user.email ?? null },
        })
      }
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [auth, readStoredUser])

  const wasSignedIn = useRef(false)
  useEffect(() => {
    if (state.status === 'signedIn') wasSignedIn.current = true
    else if (state.status === 'signedOut' && wasSignedIn.current) {
      wasSignedIn.current = false
      onSignedOut?.()
    }
  }, [state, onSignedOut])

  // Local scope: signing out on the phone shouldn't sign the learner out of
  // the web app too.
  const signOut = useCallback(async () => {
    const { error } = await auth.signOut({ scope: 'local' })
    // Offline with an expired access token, auth-js can't load the session
    // and returns early without deleting it, so delete it ourselves.
    if (error) await clearStoredSession()
    setState({ status: 'signedOut' })
  }, [auth, clearStoredSession])

  const value = useMemo(() => ({ state, signOut }), [state, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
