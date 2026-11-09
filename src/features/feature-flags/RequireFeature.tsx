import { Navigate, Outlet } from 'react-router-dom'
import type { FeatureFlag } from './flags'
import { useFeatureFlag } from './useFeatureFlag'

/** Route guard: renders child routes only while `flag` is on, else goes home. */
export function RequireFeature({ flag }: { flag: FeatureFlag }) {
  const { on, ready } = useFeatureFlag(flag)
  if (!ready) return null
  return on ? <Outlet /> : <Navigate to="/" replace />
}
