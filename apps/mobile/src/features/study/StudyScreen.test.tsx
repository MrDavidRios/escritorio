import { noEligibleCardsMessage, queryKeys, studySettingsKey } from '@escritorio/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, screen } from '@testing-library/react-native'
import { api } from '@/lib/api'
import { newId } from '@/lib/ids'
import { makeCard, makeStudySet } from '@/test/fixtures'
import { renderWithQuery } from '@/test/renderWithQuery'
import type { StudyWriter } from './createStudyWriter'
import { StudyScreen } from './StudyScreen'

jest.mock('@/lib/api', () => ({
  api: {
    studySets: { getStudySet: jest.fn() },
    cards: { listCards: jest.fn() },
    cardImages: { getSignedImageUrl: jest.fn() },
  },
}))
jest.mock('@/lib/ids', () => ({ newId: jest.fn() }))
jest.mock('@/lib/haptics', () => ({ feedbackHaptic: jest.fn() }))
jest.mock('expo-image', () => {
  const actual = jest.requireActual('expo-image')
  actual.Image.prefetch = jest.fn(() => Promise.resolve(true))
  return actual
})

// Spanish prompt, English answer (conversion, es_en).
const hablar = makeCard({ id: 'c1', spanish_term: 'hablar', english_equivalent: 'to speak' })
const comer = makeCard({
  id: 'c2',
  spanish_term: 'comer',
  english_equivalent: 'to eat',
  position: 1,
})

function fakeWriter() {
  const calls: unknown[][] = []
  const writer: StudyWriter = {
    startSession: jest.fn((input) => {
      calls.push(['startSession', input])
    }),
    recordAttempt: jest.fn((input) => {
      calls.push(['recordAttempt', input])
    }),
    completeSession: jest.fn((id, patch) => {
      calls.push(['completeSession', id, patch])
    }),
    idle: jest.fn(() => Promise.resolve()),
  }
  return { writer, calls }
}

async function setup({ set = makeStudySet(), cards = [hablar, comer] } = {}) {
  jest.mocked(api.studySets.getStudySet).mockResolvedValue(set)
  jest.mocked(api.cards.listCards).mockResolvedValue(cards)
  const { writer, calls } = fakeWriter()
  const onClose = jest.fn()
  const { client } = await renderWithQuery(
    <StudyScreen id="s1" writer={writer} onClose={onClose} />,
  )
  return { writer, calls, onClose, client }
}

async function answer(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Your answer'), text)
  await fireEvent.press(screen.getByRole('button', { name: 'Check' }))
}

const next = () => fireEvent.press(screen.getByRole('button', { name: 'Next' }))

beforeEach(async () => {
  await AsyncStorage.clear()
  let n = 0
  jest.mocked(newId).mockImplementation(() => `id-${++n}`)
  jest.mocked(api.cardImages.getSignedImageUrl).mockResolvedValue('https://example.test/i.webp')
})

test('starts a session with a client id and the set mode before any attempt', async () => {
  const { writer } = await setup()
  expect(await screen.findByText('Card 1 of 2')).toBeOnTheScreen()
  expect(screen.getByText('hablar')).toBeOnTheScreen()
  expect(writer.startSession).toHaveBeenCalledWith({
    id: 'id-1',
    started_at: expect.any(String),
    study_set_id: 's1',
    mode: 'conversion',
    direction: 'es_en',
    visibility: null,
    deck_size: 2,
  })
})

test("uses this device's stored mode over the set's own fields", async () => {
  await AsyncStorage.setItem(
    studySettingsKey('s1'),
    JSON.stringify({
      study_mode: 'conversion',
      conversion_direction: 'en_es',
      meaning_visibility: 'image',
    }),
  )
  const { writer } = await setup()
  // English prompt now, instead of the set's Spanish → English.
  expect(await screen.findByText('to speak')).toBeOnTheScreen()
  expect(writer.startSession).toHaveBeenCalledWith(
    expect.objectContaining({ mode: 'conversion', direction: 'en_es' }),
  )
})

test('records one attempt per card, in order, then completes the session', async () => {
  const { calls } = await setup()
  await screen.findByText('Card 1 of 2')

  await answer('to speak')
  await next()
  expect(screen.getByText('Card 2 of 2')).toBeOnTheScreen()
  await answer('x')
  await answer('y')
  await answer('z')
  await next()

  expect(screen.getByText('You got 1 of 2 right in "Verbos".')).toBeOnTheScreen()
  expect(calls.map((call) => call[0])).toEqual([
    'startSession',
    'recordAttempt',
    'recordAttempt',
    'completeSession',
  ])
  expect(calls[1][1]).toEqual({
    id: 'id-2',
    answered_at: expect.any(String),
    card_id: 'c1',
    is_correct: true,
    attempt_count: 1,
    session_id: 'id-1',
    resolved_direction: 'es_en',
  })
  expect(calls[2][1]).toMatchObject({
    id: 'id-3',
    card_id: 'c2',
    is_correct: false,
    attempt_count: 3,
    session_id: 'id-1',
  })
  expect(calls[3]).toEqual([
    'completeSession',
    'id-1',
    { completed_at: expect.any(String), cards_correct: 1 },
  ])
})

test('a cards refetch mid-session does not restart or resize the deck', async () => {
  const { client } = await setup()
  await screen.findByText('Card 1 of 2')
  await answer('to speak')
  await next()

  const extra = makeCard({ id: 'c3', spanish_term: 'vivir', english_equivalent: 'to live' })
  await act(async () => {
    client.setQueryData(queryKeys.cards('s1'), [hablar, comer, extra])
  })

  expect(screen.getByText('Card 2 of 2')).toBeOnTheScreen()
  expect(screen.getByText('comer')).toBeOnTheScreen()
})

test('"Study again" starts a fresh session and a fresh first card', async () => {
  const { writer } = await setup({ cards: [hablar] })
  await screen.findByText('Card 1 of 1')
  await answer('to speak')
  await next()

  await fireEvent.press(screen.getByRole('button', { name: 'Study again' }))

  expect(writer.startSession).toHaveBeenCalledTimes(2)
  expect(jest.mocked(writer.startSession).mock.calls[1][0].id).toBe('id-3')
  expect(screen.getByText('Card 1 of 1')).toBeOnTheScreen()
  expect(screen.getByLabelText('Your answer')).toHaveDisplayValue('')
  expect(screen.getByRole('button', { name: 'Check' })).toBeOnTheScreen()
})

test('explains an empty deck and starts no session', async () => {
  const set = makeStudySet({ study_mode: 'meaning', meaning_visibility: 'image' })
  const { writer } = await setup({ set })
  expect(
    await screen.findByText(noEligibleCardsMessage({ mode: 'meaning', visibility: 'image' })),
  ).toBeOnTheScreen()
  expect(writer.startSession).not.toHaveBeenCalled()
})

test('says so when the set fails to load, and Close still works', async () => {
  jest.mocked(api.studySets.getStudySet).mockRejectedValue(new Error('offline'))
  jest.mocked(api.cards.listCards).mockResolvedValue([hablar])
  const onClose = jest.fn()
  const { writer } = fakeWriter()
  await renderWithQuery(<StudyScreen id="s1" writer={writer} onClose={onClose} />)

  expect(
    await screen.findByText("Couldn't load this set. Check your connection."),
  ).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }))
  expect(onClose).toHaveBeenCalled()
})
