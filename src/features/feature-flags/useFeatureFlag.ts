import { useQuery } from '@tanstack/react-query'
import { getEnabledFeatureFlags } from '@/api/featureFlags'
import { useAuth } from '@/features/auth/AuthContext'
import { isFlagOn, type FeatureFlag } from './flags'
import { useFlagOverrides } from './overrides'

const EMPTY = new Set<string>()

/** Flags can differ per user (allowlist, rollout), so the cache is per user. */
export function useEnabledFeatureFlags() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['feature-flags', user?.id] as const,
    queryFn: async () => new Set(await getEnabledFeatureFlags()),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Whether a flag is on: a dev override if there is one, otherwise the
 * database. Off while loading and if the flags can't be fetched, so
 * unreleased features stay hidden. `ready` is false until it's known.
 */
export function useFeatureFlag(flag: FeatureFlag): { on: boolean; ready: boolean } {
  const overrides = useFlagOverrides()
  const { data, isPending } = useEnabledFeatureFlags()
  return {
    on: isFlagOn(flag, data ?? EMPTY, overrides),
    ready: overrides[flag] !== undefined || !isPending,
  }
}
