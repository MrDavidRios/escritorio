import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { StoredUser } from './storedUser'

export type AuthState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: StoredUser }

export interface AuthLike {
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void): {
    data: { subscription: { unsubscribe(): void } }
  }
}

const AuthContext = createContext<AuthState>({ status: 'loading' })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

/**
 * Signed in = a session is stored on the device (see readStoredUser).
 * After that, only explicit auth events change it: SIGNED_OUT comes from
 * a sign-out, or from auth-js rejecting the refresh token online. A null
 * INITIAL_SESSION is ignored, because offline it only means "couldn't
 * refresh yet".
 */
export function AuthProvider({
  auth,
  readStoredUser,
  children,
}: {
  auth: AuthLike
  readStoredUser: () => Promise<StoredUser | null>
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

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
