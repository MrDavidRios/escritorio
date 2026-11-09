/**
 * Every flag the client knows about, with a label for the dev menu. A flag's
 * state lives in the feature_flags table; add it there (by migration) too.
 */
export const FEATURE_FLAGS = {
  phrases: 'Phrases',
} as const

export type FeatureFlag = keyof typeof FEATURE_FLAGS

/** Dev-only local overrides; a missing key means "use the database". */
export type FlagOverrides = Partial<Record<FeatureFlag, boolean>>

function isFeatureFlag(key: string): key is FeatureFlag {
  return Object.hasOwn(FEATURE_FLAGS, key)
}

export function isFlagOn(
  flag: FeatureFlag,
  enabledInDb: ReadonlySet<string>,
  overrides: FlagOverrides,
): boolean {
  return overrides[flag] ?? enabledInDb.has(flag)
}

/** Reads stored overrides, ignoring anything malformed, unknown or stale. */
export function parseOverrides(raw: string | null): FlagOverrides {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw ?? '{}')
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

  const overrides: FlagOverrides = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (isFeatureFlag(key) && typeof value === 'boolean') overrides[key] = value
  }
  return overrides
}
