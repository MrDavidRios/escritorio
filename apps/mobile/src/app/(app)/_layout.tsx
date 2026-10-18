import { Stack } from 'expo-router'

export default function SignedInLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Study sets', headerLargeTitle: true }} />
      <Stack.Screen name="sets/[id]/index" options={{ title: '' }} />
      {/* A focused task with its own Close button; no header means the
          KeyboardAvoidingView needs no header-height offset. */}
      <Stack.Screen
        name="sets/[id]/study"
        options={{ presentation: 'fullScreenModal', headerShown: false }}
      />
    </Stack>
  )
}
