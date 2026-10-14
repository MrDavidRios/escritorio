import type { Phrase } from '@/types/phrase'

let counter = 0

/** A new (never-reviewed) phrase; override fields to place it in a schedule. */
export function makePhrase(overrides: Partial<Phrase> = {}): Phrase {
  counter += 1
  const n = String(counter).padStart(4, '0')
  return {
    id: `phrase-${n}`,
    owner_id: 'owner-1',
    spanish: `frase ${n}`,
    english: `phrase ${n}`,
    example: null,
    image_path: null,
    idiom_id: null,
    due_on: null,
    introduced_on: null,
    interval_days: 0,
    ease: 2,
    reps: 0,
    lapses: 0,
    created_at: `2026-10-01T00:00:${String(counter % 60).padStart(2, '0')}Z`,
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}
