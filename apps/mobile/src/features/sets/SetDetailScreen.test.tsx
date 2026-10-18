import { noEligibleCardsMessage, studySettingsKey } from '@escritorio/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { fireEvent, screen } from '@testing-library/react-native'
import { api } from '@/lib/api'
import { makeCard, makeStudySet } from '@/test/fixtures'
import { renderWithQuery } from '@/test/renderWithQuery'
import { SetDetailScreen } from './SetDetailScreen'
import { useLocalImageUri } from '@/features/sync/useLocalImageUri'

jest.mock('@/lib/api', () => ({
  api: {
    studySets: { getStudySet: jest.fn(), updateStudySet: jest.fn() },
    cards: { listCards: jest.fn() },
  },
}))
jest.mock('@/features/sync/useLocalImageUri', () => ({
  useLocalImageUri: jest.fn((path: string | null) => (path ? `file:///images/${path}` : null)),
}))

const hablar = makeCard({ id: 'c1', spanish_term: 'hablar', english_equivalent: 'to speak' })
const comer = makeCard({
  id: 'c2',
  spanish_term: 'comer',
  english_equivalent: null,
  definition: 'ingerir alimentos',
  image_path: 'u/c2.webp',
})

async function setup({
  set = makeStudySet({ description: 'Common verbs' }),
  cards = [hablar, comer],
} = {}) {
  jest.mocked(api.studySets.getStudySet).mockResolvedValue(set)
  jest.mocked(api.cards.listCards).mockResolvedValue(cards)
  const onStudy = jest.fn()
  await renderWithQuery(<SetDetailScreen id="s1" onStudy={onStudy} />)
  await screen.findByText('Verbos')
  return { onStudy }
}

beforeEach(async () => {
  await AsyncStorage.clear()
})

test('shows the title, card count and a read-only card preview', async () => {
  await setup()
  expect(await screen.findByText('2 cards')).toBeOnTheScreen()
  expect(screen.getByText('Common verbs')).toBeOnTheScreen()
  expect(screen.getByText('hablar')).toBeOnTheScreen()
  expect(screen.getByText('to speak')).toBeOnTheScreen()
  expect(screen.getByText('ingerir alimentos')).toBeOnTheScreen()
  expect(useLocalImageUri).toHaveBeenCalledWith('u/c2.webp')
})

test('uses the singular for one card', async () => {
  await setup({ cards: [hablar] })
  expect(await screen.findByText('1 card')).toBeOnTheScreen()
})

test("shows the set's current mode and direction as selected", async () => {
  await setup()
  expect(
    await screen.findByRole('button', { name: 'Word conversion', selected: true }),
  ).toBeOnTheScreen()
  expect(
    screen.getByRole('button', { name: 'Spanish → English', selected: true }),
  ).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Random', selected: false })).toBeOnTheScreen()
})

test('changing the direction shows it right away and keeps it on this device', async () => {
  await setup()
  await fireEvent.press(await screen.findByRole('button', { name: 'Random' }))
  // Query cache updates reach the screen on the next tick.
  expect(await screen.findByRole('button', { name: 'Random', selected: true })).toBeOnTheScreen()
  expect(JSON.parse((await AsyncStorage.getItem(studySettingsKey('s1')))!)).toMatchObject({
    conversion_direction: 'random',
  })
  expect(api.studySets.updateStudySet).not.toHaveBeenCalled()
})

test('switching to Definition to word shows its visibility options', async () => {
  await setup()
  await fireEvent.press(await screen.findByRole('button', { name: 'Definition to word' }))
  expect(
    await screen.findByRole('button', { name: 'Show image', selected: true }),
  ).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Show definition' })).toBeOnTheScreen()
})

test("opens with this device's stored choice", async () => {
  await AsyncStorage.setItem(
    studySettingsKey('s1'),
    JSON.stringify({
      study_mode: 'conversion',
      conversion_direction: 'random',
      meaning_visibility: 'image',
    }),
  )
  await setup()
  expect(await screen.findByRole('button', { name: 'Random', selected: true })).toBeOnTheScreen()
})

test('marks cards the current mode skips', async () => {
  await setup({ set: makeStudySet({ study_mode: 'meaning', meaning_visibility: 'image' }) })
  // hablar has no image; comer has one.
  expect(await screen.findByText('No image')).toBeOnTheScreen()
  expect(screen.getAllByText('No image')).toHaveLength(1)
})

test('Study opens the quiz', async () => {
  const { onStudy } = await setup()
  await fireEvent.press(await screen.findByRole('button', { name: 'Study' }))
  expect(onStudy).toHaveBeenCalled()
})

test('Study is disabled, with the reason, when the mode leaves no cards', async () => {
  // hablar has neither an image nor a definition, so "Show both" skips it.
  const { onStudy } = await setup({
    set: makeStudySet({ study_mode: 'meaning', meaning_visibility: 'both' }),
    cards: [hablar],
  })
  expect(
    await screen.findByText(noEligibleCardsMessage({ mode: 'meaning', visibility: 'both' })),
  ).toBeOnTheScreen()
  const study = screen.getByRole('button', { name: 'Study' })
  expect(study).toBeDisabled()
  await fireEvent.press(study)
  expect(onStudy).not.toHaveBeenCalled()
})
