import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'
import { Screen } from './Screen'

test('renders its children inside a themed screen', async () => {
  await render(
    <Screen>
      <Text>Hola</Text>
    </Screen>,
  )
  expect(screen.getByText('Hola')).toBeOnTheScreen()
})
