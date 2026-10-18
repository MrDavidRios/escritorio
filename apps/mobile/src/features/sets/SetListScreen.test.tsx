import { fireEvent, screen } from '@testing-library/react-native'
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

beforeEach(() => listStudySets.mockReset())

test("lists the learner's sets and opens one when tapped", async () => {
  listStudySets.mockResolvedValue([set('s1', 'Verbos', 'Common verbs'), set('s2', 'Comida')])
  const onOpenSet = jest.fn()
  await renderWithQuery(<SetListScreen onOpenSet={onOpenSet} onSignOut={jest.fn()} />)

  await fireEvent.press(await screen.findByText('Verbos'))

  expect(screen.getByText('Common verbs')).toBeOnTheScreen()
  expect(screen.getByText('Comida')).toBeOnTheScreen()
  expect(onOpenSet).toHaveBeenCalledWith('s1')
})

test('shows an empty state that points to the web app', async () => {
  listStudySets.mockResolvedValue([])
  await renderWithQuery(<SetListScreen onOpenSet={jest.fn()} onSignOut={jest.fn()} />)
  expect(await screen.findByText(/No study sets yet/)).toBeOnTheScreen()
})

test('shows an error with a retry that refetches', async () => {
  listStudySets
    .mockRejectedValueOnce(new Error('Network request failed'))
    .mockResolvedValueOnce([set('s1', 'Verbos')])
  await renderWithQuery(<SetListScreen onOpenSet={jest.fn()} onSignOut={jest.fn()} />)

  await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('Verbos')).toBeOnTheScreen()
})

test('sign out is offered', async () => {
  listStudySets.mockResolvedValue([])
  const onSignOut = jest.fn()
  await renderWithQuery(<SetListScreen onOpenSet={jest.fn()} onSignOut={onSignOut} />)
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }))
  expect(onSignOut).toHaveBeenCalled()
})
