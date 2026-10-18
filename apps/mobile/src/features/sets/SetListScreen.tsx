import type { StudySetSummary } from '@escritorio/core'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { useStudySets } from './hooks'

export function SetListScreen({
  onOpenSet,
  onSignOut,
}: {
  onOpenSet: (id: string) => void
  onSignOut: () => void
}) {
  const { data, error, isPending, isRefetching, refetch } = useStudySets()

  return (
    <Screen>
      <FlatList<StudySetSummary>
        contentInsetAdjustmentBehavior="automatic"
        data={data ?? []}
        keyExtractor={(set) => set.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
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
