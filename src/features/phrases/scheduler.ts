import type { DateKey, PhraseRating, PhraseSchedule } from '@/types/phrase'
import { addDays } from './dates'

export const STARTING_EASE = 2.0
export const MIN_EASE = 1.3
/** `good` slowly restores ease lost to hard/again, but never above the start. */
export const MAX_RECOVERED_EASE = 2.0
/** Fixed intervals for the first three reviews of a never-lapsed phrase. */
export const LEARNING_STEPS = [1, 3, 7] as const

const EASE_RECOVERY = 0.05
const HARD_EASE_PENALTY = 0.15
const AGAIN_EASE_PENALTY = 0.2
const HARD_GROWTH = 1.2

export interface ScheduleUpdate {
  due_on: DateKey
  interval_days: number
  ease: number
  reps: number
  lapses: number
}

function roundEase(ease: number): number {
  return Math.round(ease * 100) / 100
}

/**
 * SM-2-style next schedule after a scheduled review. `good` only ever means
 * correct on the first try (see ratingFor), so it's also where ease recovers.
 */
export function nextSchedule(
  current: PhraseSchedule,
  rating: PhraseRating,
  today: DateKey,
): ScheduleUpdate {
  let interval: number
  let ease = current.ease
  let lapses = current.lapses

  switch (rating) {
    case 'good':
      interval =
        current.lapses === 0 && current.reps < LEARNING_STEPS.length
          ? LEARNING_STEPS[current.reps]
          : Math.max(current.interval_days + 1, Math.round(current.interval_days * current.ease))
      ease = Math.min(MAX_RECOVERED_EASE, ease + EASE_RECOVERY)
      break
    case 'hard':
      interval =
        current.interval_days === 0
          ? 1
          : Math.max(current.interval_days + 1, Math.round(current.interval_days * HARD_GROWTH))
      ease = Math.max(MIN_EASE, ease - HARD_EASE_PENALTY)
      break
    case 'again':
      interval = 1
      ease = Math.max(MIN_EASE, ease - AGAIN_EASE_PENALTY)
      lapses += 1
      break
  }

  return {
    due_on: addDays(today, interval),
    interval_days: interval,
    ease: roundEase(ease),
    reps: current.reps + 1,
    lapses,
  }
}
