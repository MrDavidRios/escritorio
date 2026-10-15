import { afterEach, describe, expect, it, vi } from 'vitest'

describe('supabase client env check', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  // The env file moved to apps/web/ in the monorepo restructure; a
  // developer with a stale root .env.local needs to be told where it goes.
  it('points to apps/web/.env.local when the Supabase env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    await expect(import('./supabase')).rejects.toThrow('apps/web/.env.local')
  })
})
