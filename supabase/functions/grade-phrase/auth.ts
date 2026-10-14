// True when the Authorization header carries a JWT whose role is
// 'authenticated', i.e. a signed-in user rather than the public anon key.
//
// This does NOT verify the signature. It relies on the Supabase gateway's
// verify_jwt (enabled by default; never deploy with --no-verify-jwt) having
// already rejected forged or expired tokens. The anon key is a valid JWT
// that passes verify_jwt, so the role claim is what tells it apart.
export function isSignedInUser(authorizationHeader: string | null): boolean {
  const match = authorizationHeader?.match(/^Bearer\s+(\S+)$/i)
  if (!match) return false
  const parts = match[1].split('.')
  if (parts.length !== 3) return false
  try {
    const base64 = parts[1].replaceAll('-', '+').replaceAll('_', '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const payload = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))),
    )
    return typeof payload === 'object' && payload !== null && payload.role === 'authenticated'
  } catch {
    return false
  }
}
