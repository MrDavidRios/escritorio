import { onlineManager } from '@tanstack/react-query'
import { bindOnlineManager, isOnline } from './online'

test.each([
  [{ isConnected: true, isInternetReachable: true }, true],
  [{ isConnected: true, isInternetReachable: null }, true],
  [{ isConnected: null, isInternetReachable: null }, true],
  [{ isConnected: false, isInternetReachable: null }, false],
  [{ isConnected: true, isInternetReachable: false }, false],
])('%o is online: %s', (state, expected) => {
  expect(isOnline(state)).toBe(expected)
})

test('NetInfo changes drive TanStack Query online state', () => {
  let emit: (state: { isConnected: boolean; isInternetReachable: boolean }) => void = () => {}
  bindOnlineManager({
    addEventListener: (listener) => {
      emit = listener
      return () => {}
    },
  })

  emit({ isConnected: false, isInternetReachable: false })
  expect(onlineManager.isOnline()).toBe(false)
  emit({ isConnected: true, isInternetReachable: true })
  expect(onlineManager.isOnline()).toBe(true)
})
