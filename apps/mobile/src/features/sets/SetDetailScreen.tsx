import type { Card } from '@escritorio/core'
import { Image } from 'expo-image'
import { FlatList, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { useCards, useSignedImageUrl, useStudySet } from './hooks'

function CardRow({ card }: { card: Card }) {
  const { data: imageUrl } = useSignedImageUrl(card.image_path)
  const meaning = card.english_equivalent ?? card.definition
  return (
    <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
      {card.image_path ? (
        <Image
          source={imageUrl ? { uri: imageUrl } : null}
          style={{ width: 48, height: 48, borderRadius: 8 }}
          contentFit="cover"
        />
      ) : null}
      <View className="flex-1">
        <Text className="text-base font-medium text-foreground">{card.spanish_term}</Text>
        {meaning ? <Text className="text-muted-foreground">{meaning}</Text> : null}
      </View>
    </View>
  )
}

export function SetDetailScreen({ id }: { id: string }) {
  const { data: studySet } = useStudySet(id)
  const { data: cards } = useCards(id)
  const count = cards?.length

  return (
    <Screen>
      <FlatList<Card>
        contentInsetAdjustmentBehavior="automatic"
        data={cards ?? []}
        keyExtractor={(card) => card.id}
        ListHeaderComponent={
          <View className="gap-1 px-4 py-4">
            <Text className="text-2xl font-bold text-foreground">{studySet?.title ?? ''}</Text>
            {studySet?.description ? (
              <Text className="text-muted-foreground">{studySet.description}</Text>
            ) : null}
            {count != null ? (
              <Text className="text-muted-foreground">
                {count === 1 ? '1 card' : `${count} cards`}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <CardRow card={item} />}
      />
    </Screen>
  )
}
