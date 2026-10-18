import { createGoogleSignIn, type GoogleSignInDeps } from './googleSignIn'

const REDIRECT = 'escritorio://auth/callback'
const AUTH_URL = 'https://example.supabase.co/auth/v1/authorize?provider=google'

function setup(overrides: Partial<GoogleSignInDeps> = {}) {
  const deps: GoogleSignInDeps = {
    auth: {
      signInWithOAuth: jest.fn().mockResolvedValue({ data: { url: AUTH_URL }, error: null }),
      exchangeCodeForSession: jest.fn().mockResolvedValue({ error: null }),
    },
    openAuthSession: jest
      .fn()
      .mockResolvedValue({ type: 'success', url: `${REDIRECT}?code=abc123` }),
    redirectTo: REDIRECT,
    ...overrides,
  }
  return { deps, signInWithGoogle: createGoogleSignIn(deps) }
}

test('asks Supabase for the Google URL without leaving the app, then opens it', async () => {
  const { deps, signInWithGoogle } = setup()
  await signInWithGoogle()
  expect(deps.auth.signInWithOAuth).toHaveBeenCalledWith({
    provider: 'google',
    options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
  })
  expect(deps.openAuthSession).toHaveBeenCalledWith(AUTH_URL, REDIRECT)
})

test('exchanges the returned code for a session', async () => {
  const { deps, signInWithGoogle } = setup()
  expect(await signInWithGoogle()).toEqual({ error: null })
  expect(deps.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123')
})

test('treats closing the browser as a cancel, not an error', async () => {
  const { deps, signInWithGoogle } = setup({
    openAuthSession: jest.fn().mockResolvedValue({ type: 'cancel' }),
  })
  expect(await signInWithGoogle()).toEqual({ error: null })
  expect(deps.auth.exchangeCodeForSession).not.toHaveBeenCalled()
})

test('surfaces an error returned in the redirect', async () => {
  const { signInWithGoogle } = setup({
    openAuthSession: jest.fn().mockResolvedValue({
      type: 'success',
      url: `${REDIRECT}?error=access_denied&error_description=Access+was+denied`,
    }),
  })
  expect(await signInWithGoogle()).toEqual({ error: { message: 'Access was denied' } })
})

test('surfaces a Supabase error before opening the browser', async () => {
  const { deps, signInWithGoogle } = setup({
    auth: {
      signInWithOAuth: jest
        .fn()
        .mockResolvedValue({ data: { url: null }, error: { message: 'Provider is not enabled' } }),
      exchangeCodeForSession: jest.fn(),
    },
  })
  expect(await signInWithGoogle()).toEqual({ error: { message: 'Provider is not enabled' } })
  expect(deps.openAuthSession).not.toHaveBeenCalled()
})

test('surfaces a failed code exchange', async () => {
  const { signInWithGoogle } = setup({
    auth: {
      signInWithOAuth: jest.fn().mockResolvedValue({ data: { url: AUTH_URL }, error: null }),
      exchangeCodeForSession: jest
        .fn()
        .mockResolvedValue({ error: { message: 'invalid flow state' } }),
    },
  })
  expect(await signInWithGoogle()).toEqual({ error: { message: 'invalid flow state' } })
})

test('reports a redirect with no code', async () => {
  const { signInWithGoogle } = setup({
    openAuthSession: jest.fn().mockResolvedValue({ type: 'success', url: REDIRECT }),
  })
  expect(await signInWithGoogle()).toEqual({
    error: { message: 'Google sign-in did not return a code' },
  })
})
