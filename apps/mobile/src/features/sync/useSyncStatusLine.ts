import { statusLine } from './statusLine'
import { useSyncSummary } from './useSyncSummary'

export function useSyncStatusLine(): string {
  return statusLine(useSyncSummary())
}
