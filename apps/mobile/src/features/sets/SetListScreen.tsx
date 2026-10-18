import type { StudySetSummary } from '@escritorio/core'
import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { useStudySets } from './hooks'

export function SetListScreen({
  onOpenSet,
  onSignOut,
  status,
  onRefresh,
}: {
  onOpenSet: (id: string) => void
  onSignOut: () => void
  /** The sync status line, e.g. "Synced 2 min ago". */
  status: string
  /** Pull to refresh runs a full sync. */
  onRefresh: () => Promise<void>
}) {
  const { data, error, isPending, refetch } = useStudySets()
  const [refreshing, setRefreshing] = useState(false)

  async function refresh() {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <Screen>
      <FlatList<StudySetSummary>
        contentInsetAdjustmentBehavior="automatic"
        data={data ?? []}
        keyExtractor={(set) => set.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
        ListHeaderComponent={
          <Text className="px-4 pb-2 pt-1 text-sm text-muted-foreground">{status}</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => onOpenSet(item.id)}
            className="border-b border-border px-4 py-4 active:opacity-60"
          >
            <Text className="text-lg font-semibold text-foreground">{item.title}</Text>
            {item.description ? (
              <Text className="text-muted-foreground">{item.description}</Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          isPending ? undefined : error ? (
            <View className="items-center gap-3 p-8">
              <Text className="text-center text-muted-foreground">
                Couldn't load your study sets.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => refetch()}
                className="rounded-lg bg-primary px-4 py-2"
              >
                <Text className="font-semibold text-primary-foreground">Try again</Text>
              </Pressable>
            </View>
          ) : (
            <Text className="p-8 text-center text-muted-foreground">
              No study sets yet. Create one in the web app.
            </Text>
          )
        }
        ListFooterComponent={
          <Pressable accessibilityRole="button" onPress={onSignOut} className="items-center p-6">
            <Text className="text-muted-foreground underline">Sign out</Text>
          </Pressable>
        }
      />
    </Screen>
  )
}
