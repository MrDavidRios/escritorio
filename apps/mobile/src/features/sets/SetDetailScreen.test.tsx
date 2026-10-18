import { screen } from '@testing-library/react-native'
import { api } from '@/lib/api'
import { renderWithQuery } from '@/test/renderWithQuery'
import { SetDetailScreen } from './SetDetailScreen'

jest.mock('@/lib/api', () => ({
  api: {
    studySets: { getStudySet: jest.fn() },
    cards: { listCards: jest.fn() },
    cardImages: { getSignedImageUrl: jest.fn() },
  },
}))

const card = (id: string, spanish_term: string, extra: Record<string, unknown> = {}) => ({
  id,
  study_set_id: 's1',
  spanish_term,
  english_equivalent: null,
  definition: null,
  hint: null,
  image_path: null,
  position: 0,
  ...extra,
})

beforeEach(() => {
  jest
    .mocked(api.studySets.getStudySet)
    .mockResolvedValue({ id: 's1', title: 'Verbos', description: 'Common verbs' } as never)
  jest.mocked(api.cardImages.getSignedImageUrl).mockResolvedValue('https://example.test/img.webp')
})

test('shows the title, card count and a read-only card preview', async () => {
  jest
    .mocked(api.cards.listCards)
    .mockResolvedValue([
      card('c1', 'hablar', { english_equivalent: 'to speak' }),
      card('c2', 'comer', { definition: 'ingerir alimentos', image_path: 'u/c2.webp' }),
    ] as never)

  await renderWithQuery(<SetDetailScreen id="s1" />)

  expect(await screen.findByText('Verbos')).toBeOnTheScreen()
  expect(await screen.findByText('2 cards')).toBeOnTheScreen()
  expect(screen.getByText('hablar')).toBeOnTheScreen()
  expect(screen.getByText('to speak')).toBeOnTheScreen()
  expect(screen.getByText('ingerir alimentos')).toBeOnTheScreen()
  expect(api.cardImages.getSignedImageUrl).toHaveBeenCalledWith('u/c2.webp')
})

test('uses the singular for one card', async () => {
  jest.mocked(api.cards.listCards).mockResolvedValue([card('c1', 'hablar')] as never)
  await renderWithQuery(<SetDetailScreen id="s1" />)
  expect(await screen.findByText('1 card')).toBeOnTheScreen()
})
