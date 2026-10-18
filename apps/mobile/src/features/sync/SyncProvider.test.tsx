import { act, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { SyncProvider, type SyncDeps } from './SyncProvider'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function fakeDeps(claim: Promise<{ discarded: number }> = Promise.resolve({ discarded: 0 })) {
  let appStateListener: (state: string) => void = () => {}
  let onlineListener: (online: boolean) => void = () => {}
  const deps: SyncDeps = {
    claimLocalData: jest.fn(() => claim),
    load: jest.fn(async () => {}),
    resumeOutbox: jest.fn(async () => {}),
    requestSync: jest.fn(async () => {}),
    appState: {
      addEventListener: (_event, listener) => {
        appStateListener = listener
        return { remove: () => {} }
      },
    },
    subscribeOnline: (listener) => {
      onlineListener = listener
      return () => {}
    },
    alert: jest.fn(),
  }
  return {
    deps,
    foreground: () => appStateListener('active'),
    background: () => appStateListener('background'),
    setOnline: (online: boolean) => onlineListener(online),
  }
}

test('renders nothing until this user owns the local data, then syncs', async () => {
  const claim = deferred<{ discarded: number }>()
  const { deps } = fakeDeps(claim.promise)
  await render(
    <SyncProvider userId="u1" deps={deps}>
      <Text>Sets</Text>
    </SyncProvider>,
  )
  expect(screen.queryByText('Sets')).not.toBeOnTheScreen()
  expect(deps.claimLocalData).toHaveBeenCalledWith('u1')

  await act(async () => claim.resolve({ discarded: 0 }))

  expect(screen.getByText('Sets')).toBeOnTheScreen()
  expect(deps.load).toHaveBeenCalled()
  expect(deps.resumeOutbox).toHaveBeenCalled()
  expect(deps.requestSync).toHaveBeenCalledTimes(1)
  expect(deps.alert).not.toHaveBeenCalled()
})

test("warns when the previous account's unsynced results were discarded", async () => {
  const { deps } = fakeDeps(Promise.resolve({ discarded: 3 }))
  await render(
    <SyncProvider userId="u2" deps={deps}>
      <Text>Sets</Text>
    </SyncProvider>,
  )
  await screen.findByText('Sets')
  expect(deps.alert).toHaveBeenCalledWith(
    'Unsynced results removed',
    "3 study results from the account that was signed in before hadn't synced. They were removed from this phone.",
  )
})

test('syncs when the app returns to the foreground and when the connection comes back', async () => {
  const { deps, foreground, background, setOnline } = fakeDeps()
  await render(
    <SyncProvider userId="u1" deps={deps}>
      <Text>Sets</Text>
    </SyncProvider>,
  )
  await screen.findByText('Sets')

  background()
  setOnline(false)
  expect(deps.requestSync).toHaveBeenCalledTimes(1)
  foreground()
  setOnline(true)
  expect(deps.requestSync).toHaveBeenCalledTimes(3)
})
