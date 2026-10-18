import { act, render, screen } from '@testing-library/react-native'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { Text } from 'react-native'
import { AuthProvider, useAuth, type AuthLike } from './AuthProvider'
import { readStoredUser } from './storedUser'

function fakeAuth() {
  let callback: ((event: AuthChangeEvent, session: Session | null) => void) | undefined
  const auth: AuthLike = {
    onAuthStateChange: (cb) => {
      callback = cb
      return { data: { subscription: { unsubscribe: () => (callback = undefined) } } }
    },
  }
  return {
    auth,
    emit: (event: AuthChangeEvent, session: Session | null) => callback?.(event, session),
  }
}

function Status() {
  const state = useAuth()
  return <Text>{state.status === 'signedIn' ? `in:${state.user.id}` : state.status}</Text>
}

const session = { user: { id: 'u1', email: 'a@b.c' } } as Session

test('a stored session counts as signed in even when auth-js reports none (offline, expired token)', async () => {
  const { auth, emit } = fakeAuth()
  await render(
    <AuthProvider auth={auth} readStoredUser={async () => ({ id: 'u1', email: 'a@b.c' })}>
      <Status />
    </AuthProvider>,
  )

  // getSession() fails to refresh offline, so auth-js reports a null initial session.
  await act(() => emit('INITIAL_SESSION', null))

  expect(await screen.findByText('in:u1')).toBeOnTheScreen()
})

test('no stored session means signed out', async () => {
  await render(
    <AuthProvider auth={fakeAuth().auth} readStoredUser={async () => null}>
      <Status />
    </AuthProvider>,
  )
  expect(await screen.findByText('signedOut')).toBeOnTheScreen()
})

test('signing in and out updates the state', async () => {
  const { auth, emit } = fakeAuth()
  await render(
    <AuthProvider auth={auth} readStoredUser={async () => null}>
      <Status />
    </AuthProvider>,
  )
  await screen.findByText('signedOut')

  await act(() => emit('SIGNED_IN', session))
  expect(screen.getByText('in:u1')).toBeOnTheScreen()

  // Also what auth-js emits when the refresh token is rejected online.
  await act(() => emit('SIGNED_OUT', null))
  expect(screen.getByText('signedOut')).toBeOnTheScreen()
})

describe('readStoredUser', () => {
  const storage = (value: string | null) => ({
    getItem: async () => value,
    setItem: async () => {},
    removeItem: async () => {},
  })

  test('reads the user from the stored session', async () => {
    const stored = JSON.stringify({
      access_token: 'expired',
      refresh_token: 'r',
      user: { id: 'u1', email: 'a@b.c' },
    })
    expect(await readStoredUser(storage(stored), 'k')).toEqual({ id: 'u1', email: 'a@b.c' })
  })

  test('returns null for nothing stored, unparseable data, or no user', async () => {
    expect(await readStoredUser(storage(null), 'k')).toBeNull()
    expect(await readStoredUser(storage('not json'), 'k')).toBeNull()
    expect(await readStoredUser(storage('{"access_token":"x"}'), 'k')).toBeNull()
  })
})
