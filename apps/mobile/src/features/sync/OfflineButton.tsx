import { SymbolView } from 'expo-symbols'
import { PlatformColor, Pressable } from 'react-native'

/** A bare "Wi-Fi off" icon, shown only while offline; tapping it opens the details sheet. */
export function OfflineButton({ online, onPress }: { online: boolean; onPress: () => void }) {
  if (online) return null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Offline"
      accessibilityHint="Shows what is waiting to sync"
      onPress={onPress}
      className="h-11 w-11 items-center justify-center"
    >
      <SymbolView name="wifi.slash" size={20} tintColor={PlatformColor('secondaryLabel')} />
    </Pressable>
  )
}
