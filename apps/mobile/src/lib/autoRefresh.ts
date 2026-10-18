import { AppState, type AppStateStatus } from 'react-native'

export interface AppStateLike {
  // RN types this loosely (string | null | undefined) before the first change event.
  currentState: string | null | undefined
  addEventListener(event: 'change', listener: (state: AppStateStatus) => void): { remove(): void }
}

interface Refreshable {
  startAutoRefresh(): void
  stopAutoRefresh(): void
}

/**
 * auth-js only runs its refresh timer by itself in browsers. On native we
 * run it while the app is in the foreground, and stop it in the background
 * so a suspended app doesn't fire refreshes that fail.
 */
export function bindAutoRefresh(auth: Refreshable, appState: AppStateLike = AppState): () => void {
  if (appState.currentState === 'active') auth.startAutoRefresh()
  const subscription = appState.addEventListener('change', (state) => {
    if (state === 'active') auth.startAutoRefresh()
    else auth.stopAutoRefresh()
  })
  return () => subscription.remove()
}
