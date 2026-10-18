type AuthError = { message: string } | null

type AuthSessionResult = { type: 'success'; url: string } | { type: string }

export type GoogleSignInDeps = {
  auth: {
    signInWithOAuth(credentials: {
      provider: 'google'
      options: { redirectTo: string; skipBrowserRedirect: true }
    }): Promise<{ data: { url: string | null }; error: AuthError }>
    exchangeCodeForSession(code: string): Promise<{ error: AuthError }>
  }
  openAuthSession(url: string, redirectTo: string): Promise<AuthSessionResult>
  redirectTo: string
}

// Supabase's PKCE OAuth flow in an in-app browser sheet: the sheet returns
// the redirect URL to us directly, so no deep-link handler is needed.
export function createGoogleSignIn({ auth, openAuthSession, redirectTo }: GoogleSignInDeps) {
  return async function signInWithGoogle(): Promise<{ error: AuthError }> {
    const { data, error } = await auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    })
    if (error || !data.url) return { error: error ?? { message: 'Could not start Google sign-in' } }

    const result = await openAuthSession(data.url, redirectTo)
    if (result.type !== 'success' || !('url' in result)) return { error: null }

    const url = new URL(result.url)
    // Errors can come back in the query or the fragment depending on where
    // the flow failed.
    const params = new URLSearchParams(url.hash.slice(1))
    url.searchParams.forEach((value, key) => params.set(key, value))

    const oauthError = params.get('error_description') ?? params.get('error')
    if (oauthError) return { error: { message: oauthError } }

    const code = params.get('code')
    if (!code) return { error: { message: 'Google sign-in did not return a code' } }

    const exchange = await auth.exchangeCodeForSession(code)
    return { error: exchange.error }
  }
}
