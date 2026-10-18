import type { AppStateStatus } from 'react-native'
import { bindAutoRefresh, type AppStateLike } from './autoRefresh'

function fakeAppState(initial: AppStateStatus) {
  let listener: ((s: AppStateStatus) => void) | undefined
  const appState: AppStateLike = {
    currentState: initial,
    addEventListener: (_event, l) => {
      listener = l
      return { remove: () => (listener = undefined) }
    },
  }
  return { appState, emit: (s: AppStateStatus) => listener?.(s), isBound: () => !!listener }
}

function fakeAuth() {
  return { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() }
}

test('starts refreshing immediately when the app is already active', () => {
  const auth = fakeAuth()
  bindAutoRefresh(auth, fakeAppState('active').appState)
  expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1)
})

test('stops in the background and restarts in the foreground', () => {
  const auth = fakeAuth()
  const { appState, emit } = fakeAppState('active')
  bindAutoRefresh(auth, appState)

  emit('background')
  expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1)
  emit('active')
  expect(auth.startAutoRefresh).toHaveBeenCalledTimes(2)
})

test('unbinding removes the listener', () => {
  const { appState, isBound } = fakeAppState('background')
  const unbind = bindAutoRefresh(fakeAuth(), appState)
  unbind()
  expect(isBound()).toBe(false)
})
