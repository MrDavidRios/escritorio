import { describe, expect, it } from 'vitest'
import { createApi } from './index'
import { fakeSupabase } from './testing/fakeSupabase'

const attempt = {
  card_id: 'card-1',
  is_correct: true,
  attempt_count: 1,
  session_id: 'session-1',
  resolved_direction: null,
}

const session = {
  study_set_id: 'set-1',
  mode: 'meaning' as const,
  direction: null,
  visibility: 'both' as const,
  deck_size: 10,
}

describe('createQuizAttempt', () => {
  it('inserts with ON CONFLICT (id) DO NOTHING', async () => {
    const { client, requests } = fakeSupabase(() => ({ status: 201 }))

    await createApi(client).quizAttempts.createQuizAttempt(attempt)

    expect(requests[0].method).toBe('POST')
    expect(requests[0].url.pathname).toBe('/rest/v1/quiz_attempts')
    expect(requests[0].url.searchParams.get('on_conflict')).toBe('id')
    expect(requests[0].headers.get('prefer')).toContain('resolution=ignore-duplicates')
  })

  it('sends a client-chosen id and answered_at when given', async () => {
    const { client, requests } = fakeSupabase(() => ({ status: 201 }))

    await createApi(client).quizAttempts.createQuizAttempt({
      ...attempt,
      id: 'attempt-1',
      answered_at: '2026-10-15T09:00:00.000Z',
    })

    expect(requests[0].body).toMatchObject({
      id: 'attempt-1',
      answered_at: '2026-10-15T09:00:00.000Z',
    })
  })

  it('omits id when not given, so the database generates one', async () => {
    const { client, requests } = fakeSupabase(() => ({ status: 201 }))

    await createApi(client).quizAttempts.createQuizAttempt(attempt)

    expect(requests[0].body).not.toHaveProperty('id')
  })

  it('throws database errors with their code', async () => {
    const { client } = fakeSupabase(() => ({
      status: 400,
      body: { code: 'P0001', message: 'card_id card-1 does not exist' },
    }))

    await expect(createApi(client).quizAttempts.createQuizAttempt(attempt)).rejects.toMatchObject({
      code: 'P0001',
    })
  })
})

describe('createStudySession', () => {
  it('inserts with ON CONFLICT (id) DO NOTHING and returns the new row', async () => {
    const row = {
      ...session,
      id: 'session-1',
      owner_id: 'u',
      cards_correct: 0,
      started_at: 't',
      completed_at: null,
    }
    const { client, requests } = fakeSupabase(() => ({ status: 201, body: [row] }))

    const created = await createApi(client).studySessions.createStudySession({
      ...session,
      id: 'session-1',
      started_at: '2026-10-15T09:00:00.000Z',
    })

    expect(created).toEqual(row)
    expect(requests[0].url.searchParams.get('on_conflict')).toBe('id')
    expect(requests[0].headers.get('prefer')).toContain('resolution=ignore-duplicates')
    expect(requests[0].body).toMatchObject({
      id: 'session-1',
      started_at: '2026-10-15T09:00:00.000Z',
    })
  })

  it('returns null when a session with that id already exists (a retried send)', async () => {
    const { client } = fakeSupabase(() => ({ status: 201, body: [] }))

    const created = await createApi(client).studySessions.createStudySession({
      ...session,
      id: 'session-1',
    })

    expect(created).toBeNull()
  })
})
