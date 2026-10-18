import { Stack } from 'expo-router'

export default function SignedInLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Study sets', headerLargeTitle: true }} />
      <Stack.Screen name="sets/[id]" options={{ title: '' }} />
    </Stack>
  )
}
