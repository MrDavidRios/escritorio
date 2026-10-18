import { fireEvent, render, screen } from '@testing-library/react-native'
import { OfflineButton } from './OfflineButton'

test('shows nothing while online', async () => {
  await render(<OfflineButton online onPress={jest.fn()} />)
  expect(screen.queryByRole('button', { name: 'Offline' })).not.toBeOnTheScreen()
})

test('offline, shows an icon button that opens the details', async () => {
  const onPress = jest.fn()
  await render(<OfflineButton online={false} onPress={onPress} />)
  const button = screen.getByRole('button', { name: 'Offline' })
  expect(button.props.accessibilityHint).toBe('Shows what is waiting to sync')
  await fireEvent.press(button)
  expect(onPress).toHaveBeenCalled()
})
