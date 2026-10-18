import { fireEvent, render, screen } from '@testing-library/react-native'
import { AccentPad } from './AccentPad'
import { SPANISH_ACCENTS } from './spanishAccents'

test('offers every Spanish accented letter', async () => {
  await render(<AccentPad onInsert={jest.fn()} />)
  for (const char of SPANISH_ACCENTS) {
    expect(screen.getByRole('button', { name: `Insert ${char}` })).toBeOnTheScreen()
  }
})

test('inserts the tapped letter', async () => {
  const onInsert = jest.fn()
  await render(<AccentPad onInsert={onInsert} />)
  await fireEvent.press(screen.getByRole('button', { name: 'Insert ñ' }))
  expect(onInsert).toHaveBeenCalledWith('ñ')
})

test('does nothing while disabled', async () => {
  const onInsert = jest.fn()
  await render(<AccentPad onInsert={onInsert} disabled />)
  await fireEvent.press(screen.getByRole('button', { name: 'Insert á' }))
  expect(onInsert).not.toHaveBeenCalled()
})
