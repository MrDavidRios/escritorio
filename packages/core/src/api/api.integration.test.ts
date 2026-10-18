import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { createApi, type Api } from './index'

// Runs only against a local stack:
//   bun run db:start && bun run --filter @escritorio/core test:integration
// It proves the RLS behaviour unit tests can't: ON CONFLICT DO NOTHING
// under insert-only policies, and lineage-trigger errors.
const url = process.env.SUPABASE_INTEGRATION_URL
const anonKey = process.env.SUPABASE_INTEGRATION_ANON_KEY

describe.skipIf(!url || !anonKey)('API against local Supabase', () => {
  let supabase: SupabaseClient
  let api: Api
  let studySetId: string
  let cardId: string

  beforeAll(async () => {
    supabase = createClient(url!, anonKey!, { auth: { persistSession: false } })
    const { data, error } = await supabase.auth.signUp({
      email: `it-${randomUUID()}@example.test`,
      password: 'integration-test-password',
    })
    if (error) throw error
    api = createApi(supabase)
    const set = await api.studySets.createStudySet(data.user!.id, {
      title: 'Integration',
      description: null,
      image_path: null,
    })
    studySetId = set.id
    cardId = randomUUID()
    await api.cards.createCard(cardId, studySetId, {
      spanish_term: 'hola',
      english_equivalent: 'hello',
      definition: null,
      hint: null,
      image_path: null,
      position: 0,
    })
  })

  async function count(table: string, column: string, value: string) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(column, value)
    if (error) throw error
    return count
  }

  it('a re-sent study session lands once, with the client timestamp', async () => {
    const id = randomUUID()
    const input = {
      id,
      study_set_id: studySetId,
      mode: 'meaning' as const,
      direction: null,
      visibility: 'both' as const,
      deck_size: 1,
      started_at: '2026-01-02T03:04:05.000Z',
    }

    const first = await api.studySessions.createStudySession(input)
    const second = await api.studySessions.createStudySession(input)

    expect(first?.started_at).toBe('2026-01-02T03:04:05+00:00')
    expect(second).toBeNull()
    expect(await count('study_sessions', 'id', id)).toBe(1)
  })

  it('a re-sent quiz attempt lands once, with the client timestamp', async () => {
    const id = randomUUID()
    const input = {
      id,
      card_id: cardId,
      is_correct: true,
      attempt_count: 1,
      session_id: null,
      resolved_direction: null,
      answered_at: '2026-01-02T03:04:05.000Z',
    }

    await api.quizAttempts.createQuizAttempt(input)
    await api.quizAttempts.createQuizAttempt(input)

    expect(await count('quiz_attempts', 'id', id)).toBe(1)
    const { data } = await supabase
      .from('quiz_attempts')
      .select('answered_at')
      .eq('id', id)
      .single()
    expect(data?.answered_at).toBe('2026-01-02T03:04:05+00:00')
  })

  it('attempts sent without an id are never deduplicated', async () => {
    const before = (await count('quiz_attempts', 'card_id', cardId)) ?? 0
    const input = {
      card_id: cardId,
      is_correct: false,
      attempt_count: 3,
      session_id: null,
      resolved_direction: null,
    }

    await api.quizAttempts.createQuizAttempt(input)
    await api.quizAttempts.createQuizAttempt(input)

    expect(await count('quiz_attempts', 'card_id', cardId)).toBe(before + 2)
  })

  it('an attempt for a deleted card rejects with the lineage trigger code', async () => {
    await expect(
      api.quizAttempts.createQuizAttempt({
        id: randomUUID(),
        card_id: randomUUID(),
        is_correct: true,
        attempt_count: 1,
        session_id: null,
        resolved_direction: null,
      }),
    ).rejects.toMatchObject({ code: 'P0001' })
  })
})
