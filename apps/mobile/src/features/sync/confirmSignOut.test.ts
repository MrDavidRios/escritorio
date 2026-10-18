import { createConfirmSignOut } from './confirmSignOut'

function setup(pending: number) {
  const log: string[] = []
  const deps = {
    pendingCount: () => pending,
    signOut: jest.fn(async () => void log.push('signOut')),
    wipe: jest.fn(async () => {
      log.push('wipe')
      return pending
    }),
    alert: jest.fn(),
  }
  return { confirmSignOut: createConfirmSignOut(deps), deps, log }
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

test('with nothing queued, signs out and clears local data straight away', async () => {
  const { confirmSignOut, deps, log } = setup(0)
  confirmSignOut()
  await flushPromises()
  expect(deps.alert).not.toHaveBeenCalled()
  expect(log).toEqual(['signOut', 'wipe'])
})

test('with results queued, asks first and only signs out on confirm', async () => {
  const { confirmSignOut, deps, log } = setup(2)
  confirmSignOut()
  expect(log).toEqual([])
  const [title, message, buttons] = deps.alert.mock.calls[0] as unknown as [
    string,
    string,
    { text: string; onPress: () => void }[],
  ]
  expect(title).toBe('Sign out?')
  expect(message).toBe(
    "2 study results haven't synced yet. Signing out deletes them from this phone.",
  )
  expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Sign out'])

  buttons[1].onPress()
  await flushPromises()
  expect(log).toEqual(['signOut', 'wipe'])
})
