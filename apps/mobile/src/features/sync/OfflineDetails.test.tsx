import { fireEvent, render, screen } from '@testing-library/react-native'
import { OfflineDetails } from './OfflineDetails'

const now = new Date('2026-10-18T12:00:00.000Z')

function renderDetails(overrides: Partial<Parameters<typeof OfflineDetails>[0]> = {}) {
  const props = {
    online: false,
    pendingAnswers: 3,
    lastSyncedAt: '2026-10-18T10:00:00.000Z',
    now,
    onDone: jest.fn(),
    ...overrides,
  }
  return render(<OfflineDetails {...props} />).then(() => props)
}

test('explains being offline, with what is waiting and when it last synced', async () => {
  await renderDetails()
  expect(screen.getByRole('header', { name: "You're offline" })).toBeOnTheScreen()
  expect(
    screen.getByText('You can keep studying. Your sets, cards and images are saved on this phone.'),
  ).toBeOnTheScreen()
  expect(screen.getByText('Waiting to sync')).toBeOnTheScreen()
  expect(screen.getByText('3 answers')).toBeOnTheScreen()
  expect(screen.getByText('Last synced')).toBeOnTheScreen()
  expect(screen.getByText('2 h ago')).toBeOnTheScreen()
  expect(screen.getByText("Answers sync on their own when you're back online.")).toBeOnTheScreen()
})

test('uses the singular for one answer', async () => {
  await renderDetails({ pendingAnswers: 1 })
  expect(screen.getByText('1 answer')).toBeOnTheScreen()
})

test('with nothing queued and no sync yet', async () => {
  await renderDetails({ pendingAnswers: 0, lastSyncedAt: null })
  expect(screen.getByText('Nothing')).toBeOnTheScreen()
  expect(screen.getByText('Not yet')).toBeOnTheScreen()
})

test('says so if the connection comes back while it is open', async () => {
  await renderDetails({ online: true })
  expect(screen.getByRole('header', { name: "You're back online" })).toBeOnTheScreen()
  expect(screen.getByText('Your answers are syncing now.')).toBeOnTheScreen()
  expect(
    screen.queryByText("Answers sync on their own when you're back online."),
  ).not.toBeOnTheScreen()
})

test('Got it closes it', async () => {
  const { onDone } = await renderDetails()
  await fireEvent.press(screen.getByRole('button', { name: 'Got it' }))
  expect(onDone).toHaveBeenCalled()
})
