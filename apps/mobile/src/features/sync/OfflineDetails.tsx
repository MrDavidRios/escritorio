import { SymbolView } from 'expo-symbols'
import { PlatformColor, Pressable, Text, View } from 'react-native'
import { timeAgo } from './statusLine'

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function Detail({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <View
      className={`flex-row items-center justify-between px-3.5 py-3 ${divider ? 'border-b border-border' : ''}`}
    >
      <Text className="text-[15px] text-foreground">{label}</Text>
      <Text className="text-[15px] font-semibold text-foreground">{value}</Text>
    </View>
  )
}

/** The offline details sheet: what still works, and what is waiting to sync. */
export function OfflineDetails({
  online,
  pendingAnswers,
  lastSyncedAt,
  now,
  onDone,
}: {
  online: boolean
  pendingAnswers: number
  lastSyncedAt: string | null
  now: Date
  onDone: () => void
}) {
  const ago = lastSyncedAt ? timeAgo(lastSyncedAt, now) : null
  return (
    <View className="gap-4 bg-background px-5 pb-8 pt-6">
      <View className="flex-row items-center gap-2.5">
        <SymbolView
          name={online ? 'wifi' : 'wifi.slash'}
          size={22}
          tintColor={PlatformColor('label')}
        />
        <Text accessibilityRole="header" className="text-xl font-bold text-foreground">
          {online ? "You're back online" : "You're offline"}
        </Text>
      </View>
      <Text className="text-[15px] text-muted-foreground">
        {online
          ? 'Your answers are syncing now.'
          : 'You can keep studying. Your sets, cards and images are saved on this phone.'}
      </Text>
      <View className="rounded-xl bg-muted">
        <Detail
          label="Waiting to sync"
          value={pendingAnswers === 0 ? 'Nothing' : plural(pendingAnswers, 'answer')}
          divider
        />
        <Detail
          label="Last synced"
          value={ago ? ago.charAt(0).toUpperCase() + ago.slice(1) : 'Not yet'}
        />
      </View>
      {online ? null : (
        <Text className="text-[13px] text-muted-foreground">
          Answers sync on their own when you're back online.
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onDone}
        className="items-center rounded-lg bg-primary py-3"
      >
        <Text className="text-base font-semibold text-primary-foreground">Got it</Text>
      </Pressable>
    </View>
  )
}
