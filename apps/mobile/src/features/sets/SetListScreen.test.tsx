import { act, fireEvent, screen } from '@testing-library/react-native'
import { api } from '@/lib/api'
import { renderWithQuery } from '@/test/renderWithQuery'
import { SetListScreen } from './SetListScreen'

jest.mock('@/lib/api', () => ({
  api: { studySets: { listStudySets: jest.fn() } },
}))

const listStudySets = api.studySets.listStudySets as jest.Mock

const set = (id: string, title: string, description: string | null = null) => ({
  id,
  title,
  description,
  image_path: null,
  fallback_image_paths: [],
})

function renderList(overrides: Partial<Parameters<typeof SetListScreen>[0]> = {}) {
  const props = {
    onOpenSet: jest.fn(),
    onSignOut: jest.fn(),
    status: 'Synced just now',
    onRefresh: jest.fn(async () => {}),
    ...overrides,
  }
  return renderWithQuery(<SetListScreen {...props} />).then(() => props)
}

beforeEach(() => listStudySets.mockReset())

test("lists the learner's sets and opens one when tapped", async () => {
  listStudySets.mockResolvedValue([set('s1', 'Verbos', 'Common verbs'), set('s2', 'Comida')])
  const { onOpenSet } = await renderList()

  await fireEvent.press(await screen.findByText('Verbos'))

  expect(screen.getByText('Common verbs')).toBeOnTheScreen()
  expect(screen.getByText('Comida')).toBeOnTheScreen()
  expect(onOpenSet).toHaveBeenCalledWith('s1')
})

test('shows the sync status line', async () => {
  listStudySets.mockResolvedValue([set('s1', 'Verbos')])
  await renderList({ status: 'Offline · 2 answers waiting to sync' })
  expect(await screen.findByText('Offline · 2 answers waiting to sync')).toBeOnTheScreen()
})

test('pull to refresh runs a sync', async () => {
  listStudySets.mockResolvedValue([set('s1', 'Verbos')])
  const { onRefresh } = await renderList()
  await screen.findByText('Verbos')

  // React Native's Jest preset renders RefreshControl as a prop-less stub and
  // keeps the last mounted one here, so this is how a test pulls to refresh.
  const { default: RefreshControlMock } = jest.requireMock(
    'react-native/Libraries/Components/RefreshControl/RefreshControl',
  )
  await act(async () => RefreshControlMock.latestRef.props.onRefresh())

  expect(onRefresh).toHaveBeenCalled()
})

test('shows an empty state that points to the web app', async () => {
  listStudySets.mockResolvedValue([])
  await renderList()
  expect(await screen.findByText(/No study sets yet/)).toBeOnTheScreen()
})

test('shows an error with a retry that refetches', async () => {
  listStudySets
    .mockRejectedValueOnce(new Error('Network request failed'))
    .mockResolvedValueOnce([set('s1', 'Verbos')])
  await renderList()

  await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('Verbos')).toBeOnTheScreen()
})

test('sign out is offered', async () => {
  listStudySets.mockResolvedValue([])
  const { onSignOut } = await renderList()
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }))
  expect(onSignOut).toHaveBeenCalled()
})
