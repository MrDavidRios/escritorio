// grade-phrase: a stateless proxy that asks Jev whether a typed Spanish
// phrase is acceptable, keeping TYPESAFE_API_KEY off the client. Callers
// must be signed in (Supabase verifies the JWT before this runs). It never
// touches the database. See the phrase spaced repetition spec.

import { buildJevPayload, JEV_URL, parseGradeRequest, parseJevResponse } from './jev.ts'

// Below the client's 4 s budget, so the client sees a clean 502 rather
// than its own timeout.
const JEV_FETCH_TIMEOUT_MS = 3500

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = await req.json().catch(() => null)

  // Sent once at session start so a cold start doesn't eat into the first
  // real grade's timeout.
  if (body?.warmup === true) return new Response(null, { status: 204, headers: corsHeaders })

  const request = parseGradeRequest(body)
  if (!request) return json({ error: 'invalid request' }, 400)

  const apiKey = Deno.env.get('TYPESAFE_API_KEY')
  if (!apiKey) return json({ error: 'grading unavailable' }, 503)

  const response = await fetch(JEV_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildJevPayload(request)),
    signal: AbortSignal.timeout(JEV_FETCH_TIMEOUT_MS),
  }).catch((error) => {
    console.error('Jev request failed:', error)
    return null
  })

  if (!response?.ok) {
    if (response)
      console.error('Jev responded', response.status, await response.text().catch(() => ''))
    return json({ error: 'grader failed' }, 502)
  }

  const grade = parseJevResponse(await response.json().catch(() => null))
  if (!grade) return json({ error: 'grader failed' }, 502)
  return json(grade, 200)
})
