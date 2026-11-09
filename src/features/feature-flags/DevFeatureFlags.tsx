import { FEATURE_FLAGS, type FeatureFlag } from './flags'
import { FeatureFlagsMenu } from './FeatureFlagsMenu'
import { setFlagOverride, useFlagOverrides } from './overrides'
import { useEnabledFeatureFlags } from './useFeatureFlag'

/** Feeds FeatureFlagsMenu. Render only in dev builds. */
export function DevFeatureFlags() {
  const overrides = useFlagOverrides()
  const { data } = useEnabledFeatureFlags()

  const rows = (Object.keys(FEATURE_FLAGS) as FeatureFlag[]).map((flag) => ({
    flag,
    label: FEATURE_FLAGS[flag],
    dbOn: data ? data.has(flag) : null,
    override: overrides[flag],
  }))

  return <FeatureFlagsMenu rows={rows} onOverride={setFlagOverride} />
}
