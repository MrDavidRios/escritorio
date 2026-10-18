import type { SupabaseClient } from '@supabase/supabase-js'
import { createCardImagesApi } from './cardImages'
import { createCardsApi } from './cards'
import { createQuizAttemptsApi } from './quizAttempts'
import { createStudySessionsApi } from './studySessions'
import { createStudySetImagesApi } from './studySetImages'
import { createStudySetsApi } from './studySets'

/**
 * Every Supabase read and write the apps make, bound to one client. Each
 * app builds its own client (web: localStorage session; mobile: encrypted
 * storage) and calls this once.
 */
export function createApi(supabase: SupabaseClient) {
  return {
    studySets: createStudySetsApi(supabase),
    cards: createCardsApi(supabase),
    cardImages: createCardImagesApi(supabase),
    studySetImages: createStudySetImagesApi(supabase),
    quizAttempts: createQuizAttemptsApi(supabase),
    studySessions: createStudySessionsApi(supabase),
  }
}

export type Api = ReturnType<typeof createApi>
