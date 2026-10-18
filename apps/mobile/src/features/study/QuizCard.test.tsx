import { buildQuestion, type Card } from '@escritorio/core'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { feedbackHaptic } from '@/lib/haptics'
import { makeCard } from '@/test/fixtures'
import { QuizCard } from './QuizCard'

jest.mock('@/lib/haptics', () => ({ feedbackHaptic: jest.fn() }))

// English prompt, Spanish answer: "to speak" → "hablar".
const toSpanish = (overrides: Partial<Card> = {}) =>
  buildQuestion(makeCard(overrides), { mode: 'conversion', direction: 'en_es' })

async function setup(question = toSpanish(), imageUrl?: string) {
  const onAnswered = jest.fn()
  const onNext = jest.fn()
  await render(
    <QuizCard question={question} imageUrl={imageUrl} onAnswered={onAnswered} onNext={onNext} />,
  )
  return { onAnswered, onNext }
}

const answerField = () => screen.getByLabelText('Your answer')

async function submit(text: string) {
  await fireEvent.changeText(answerField(), text)
  await fireEvent.press(screen.getByRole('button', { name: 'Check' }))
}

test('shows the prompt and accepts a correct answer, forgivingly', async () => {
  const { onAnswered, onNext } = await setup()
  expect(screen.getByText('to speak')).toBeOnTheScreen()

  await submit('  Hablar. ')

  expect(screen.getByText('Correct!')).toBeOnTheScreen()
  expect(onAnswered).toHaveBeenCalledWith({ isCorrect: true, attemptCount: 1 })
  expect(feedbackHaptic).toHaveBeenCalledWith('correct')
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }))
  expect(onNext).toHaveBeenCalledTimes(1)
})

test('gives three attempts, then reveals the answer', async () => {
  const { onAnswered } = await setup()

  await submit('comer')
  expect(screen.getByText('Not quite. 2 attempts left.')).toBeOnTheScreen()
  expect(answerField()).toHaveDisplayValue('')
  expect(feedbackHaptic).toHaveBeenLastCalledWith('retry')

  await submit('beber')
  expect(screen.getByText('Not quite. 1 attempt left.')).toBeOnTheScreen()

  await submit('vivir')
  expect(screen.getByText('Not quite. The answer was: hablar')).toBeOnTheScreen()
  expect(feedbackHaptic).toHaveBeenLastCalledWith('revealed')
  expect(onAnswered).toHaveBeenCalledTimes(1)
  expect(onAnswered).toHaveBeenCalledWith({ isCorrect: false, attemptCount: 3 })
  expect(screen.getByRole('button', { name: 'Next' })).toBeOnTheScreen()
})

test('a correct answer on the last attempt counts as correct', async () => {
  const { onAnswered } = await setup()
  await submit('comer')
  await submit('beber')
  await submit('hablar')
  expect(onAnswered).toHaveBeenCalledTimes(1)
  expect(onAnswered).toHaveBeenCalledWith({ isCorrect: true, attemptCount: 3 })
})

test('the return key submits', async () => {
  await setup()
  await fireEvent.changeText(answerField(), 'hablar')
  await fireEvent(answerField(), 'submitEditing')
  expect(screen.getByText('Correct!')).toBeOnTheScreen()
})

test('an empty answer is ignored rather than using up an attempt', async () => {
  const { onAnswered } = await setup()
  await submit('   ')
  expect(screen.queryByText(/Not quite/)).not.toBeOnTheScreen()
  expect(onAnswered).not.toHaveBeenCalled()
  expect(feedbackHaptic).not.toHaveBeenCalled()
})

test('the answer field turns off capitalization, autocorrect and spellcheck', async () => {
  await setup()
  expect(answerField().props).toMatchObject({
    autoCapitalize: 'none',
    autoCorrect: false,
    spellCheck: false,
    returnKeyType: 'go',
  })
})

test('the accent pad inserts at the cursor', async () => {
  await setup()
  await fireEvent.changeText(answerField(), 'caa')
  await fireEvent(answerField(), 'selectionChange', {
    nativeEvent: { selection: { start: 2, end: 2 } },
  })
  await fireEvent.press(screen.getByRole('button', { name: 'Insert ñ' }))
  expect(answerField()).toHaveDisplayValue('caña')
})

test('no accent pad when the answer is in English', async () => {
  await setup(buildQuestion(makeCard(), { mode: 'conversion', direction: 'es_en' }))
  expect(screen.queryByRole('button', { name: 'Insert á' })).not.toBeOnTheScreen()
})

test('shows the hint on request', async () => {
  await setup(toSpanish({ hint: 'starts with h' }))
  await fireEvent.press(screen.getByRole('button', { name: 'Show hint' }))
  expect(screen.getByText('Hint: starts with h')).toBeOnTheScreen()
})

test('meaning mode shows the definition, not the word', async () => {
  await setup(
    buildQuestion(makeCard({ definition: 'emitir palabras' }), {
      mode: 'meaning',
      visibility: 'definition',
    }),
  )
  expect(screen.getByText('emitir palabras')).toBeOnTheScreen()
  expect(screen.queryByText('hablar')).not.toBeOnTheScreen()
})

test('shows a placeholder while the image URL loads', async () => {
  await setup(
    buildQuestion(makeCard({ image_path: 'u/c1.webp' }), { mode: 'meaning', visibility: 'image' }),
  )
  expect(screen.getByText('Loading image…')).toBeOnTheScreen()
})

test('two submits of a right answer in one frame count it once', async () => {
  const { onAnswered } = await setup()
  await fireEvent.changeText(answerField(), 'hablar')
  const field = answerField()
  await act(async () => {
    field.props.onSubmitEditing()
    field.props.onSubmitEditing()
  })
  expect(onAnswered).toHaveBeenCalledTimes(1)
})

test('two submits in one frame after the card ends advance only once', async () => {
  const { onNext } = await setup()
  await submit('hablar')
  const field = answerField()
  await act(async () => {
    field.props.onSubmitEditing()
    field.props.onSubmitEditing()
  })
  expect(onNext).toHaveBeenCalledTimes(1)
})

test('typing after the card ends does not change the shown answer', async () => {
  await setup()
  await submit('hablar')
  await fireEvent.changeText(answerField(), 'something else')
  expect(answerField()).toHaveDisplayValue('hablar')
})
