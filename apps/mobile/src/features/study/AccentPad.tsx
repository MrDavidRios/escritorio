import { Pressable, Text, View } from 'react-native'
import { SPANISH_ACCENTS } from './spanishAccents'

/**
 * The accented letters Spanish uses, as a row that sits above the
 * keyboard. Pressables outside a ScrollView don't take focus, so the
 * answer field (and its keyboard) stays up while tapping these.
 */
export function AccentPad({
  onInsert,
  disabled = false,
}: {
  onInsert: (char: string) => void
  disabled?: boolean
}) {
  return (
    <View
      accessibilityRole="toolbar"
      accessibilityLabel="Spanish accented characters"
      className="flex-row gap-2"
    >
      {SPANISH_ACCENTS.map((char) => (
        <Pressable
          key={char}
          accessibilityRole="button"
          accessibilityLabel={`Insert ${char}`}
          disabled={disabled}
          onPress={() => onInsert(char)}
          className="h-11 flex-1 items-center justify-center rounded-lg border border-border bg-card disabled:opacity-50"
        >
          <Text className="text-lg text-foreground">{char}</Text>
        </Pressable>
      ))}
    </View>
  )
}
