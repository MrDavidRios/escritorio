import { assertEquals } from 'jsr:@std/assert@1'
import { isSignedInUser } from './auth.ts'

function b64url(text: string): string {
  return btoa(text).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function tokenWith(payload: unknown): string {
  return `${b64url('{"alg":"HS256"}')}.${b64url(JSON.stringify(payload))}.sig`
}

Deno.test('authenticated-role token is a signed-in user', () => {
  assertEquals(isSignedInUser(`Bearer ${tokenWith({ role: 'authenticated', sub: 'u1' })}`), true)
})

Deno.test('anon-role token is rejected', () => {
  assertEquals(isSignedInUser(`Bearer ${tokenWith({ role: 'anon' })}`), false)
})

Deno.test('payload without a role is rejected', () => {
  assertEquals(isSignedInUser(`Bearer ${tokenWith({ sub: 'u1' })}`), false)
})

Deno.test('missing header is rejected', () => {
  assertEquals(isSignedInUser(null), false)
})

Deno.test('non-Bearer scheme is rejected', () => {
  assertEquals(isSignedInUser(`Basic ${tokenWith({ role: 'authenticated' })}`), false)
})

Deno.test('malformed token is rejected', () => {
  assertEquals(isSignedInUser('Bearer not-a-jwt'), false)
  assertEquals(isSignedInUser('Bearer '), false)
})

Deno.test('undecodable payload is rejected', () => {
  assertEquals(isSignedInUser('Bearer aaa.!!!.sig'), false)
  assertEquals(isSignedInUser(`Bearer aaa.${b64url('not json')}.sig`), false)
  assertEquals(isSignedInUser(`Bearer aaa.${b64url('"authenticated"')}.sig`), false)
})
