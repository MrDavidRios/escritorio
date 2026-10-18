import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const FAKE_SUPABASE_URL = 'http://supabase.test'

export interface RecordedRequest {
  method: string
  url: URL
  headers: Headers
  // Parsed JSON when the body is JSON, the raw text otherwise.
  body: unknown
}

export interface FakeResponse {
  status?: number
  body?: unknown
}

/**
 * A real supabase-js client whose network calls go to `respond` instead
 * of a server, so tests assert on the HTTP requests the API actually
 * makes (paths, query params, Prefer headers, bodies).
 */
export function fakeSupabase(respond: (request: RecordedRequest) => FakeResponse = () => ({})) {
  const requests: RecordedRequest[] = []

  const fakeFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    const text = await request.text()
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : undefined
    } catch {
      // Not JSON (e.g. a multipart upload): keep the raw text.
    }
    const recorded: RecordedRequest = {
      method: request.method,
      url: new URL(request.url),
      headers: request.headers,
      body,
    }
    requests.push(recorded)

    const { status = 200, body: responseBody = [] } = respond(recorded)
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }

  const client: SupabaseClient = createClient(FAKE_SUPABASE_URL, 'anon-key', {
    global: { fetch: fakeFetch },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { client, requests }
}
