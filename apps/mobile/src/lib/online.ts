import NetInfo from '@react-native-community/netinfo'
import { onlineManager } from '@tanstack/react-query'

type ConnectionState = { isConnected: boolean | null; isInternetReachable?: boolean | null }

/** Unknown (null) counts as online, so a slow reachability check never blocks a sync. */
export function isOnline(state: ConnectionState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false
}

/** TanStack Query's online state follows NetInfo. Call once at startup. */
export function bindOnlineManager(
  netInfo: { addEventListener(listener: (state: ConnectionState) => void): () => void } = NetInfo,
): void {
  onlineManager.setEventListener((setOnline) =>
    netInfo.addEventListener((state) => setOnline(isOnline(state))),
  )
}
