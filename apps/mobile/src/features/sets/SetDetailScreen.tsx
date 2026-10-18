import {
  configFromFields,
  eligibleCards,
  exclusionReason,
  noEligibleCardsMessage,
  type Card,
  type StudyConfig,
} from '@escritorio/core'
import { Image } from 'expo-image'
import { FlatList, Pressable, Text, View } from 'react-native'
import { Screen } from '@/components/Screen'
import { useLocalImageUri } from '@/features/sync/useLocalImageUri'
import { useCards, useStudySet } from './hooks'
import { StudyModePicker } from './StudyModePicker'
import { useStudySettings } from './studySettings'

function CardRow({ card, config }: { card: Card; config: StudyConfig | null }) {
  const imageUrl = useLocalImageUri(card.image_path)
  const meaning = card.english_equivalent ?? card.definition
  const excluded = config ? exclusionReason(card, config) : null
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
      {excluded ? (
        <View className="rounded-md bg-muted px-2 py-1">
          <Text className="text-xs text-muted-foreground">{excluded}</Text>
        </View>
      ) : null}
    </View>
  )
}

export function SetDetailScreen({ id, onStudy }: { id: string; onStudy: () => void }) {
  const { data: studySet } = useStudySet(id)
  const { data: cards } = useCards(id)
  const { settings, update } = useStudySettings(id)
  const count = cards?.length
  const config = settings ? configFromFields(settings) : null
  const eligibleCount = config && cards ? eligibleCards(cards, config).length : 0

  return (
    <Screen>
      <FlatList<Card>
        contentInsetAdjustmentBehavior="automatic"
        data={cards ?? []}
        keyExtractor={(card) => card.id}
        ListHeaderComponent={
          <View className="gap-3 px-4 py-4">
            <View className="gap-1">
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

            {settings ? (
              <>
                <StudyModePicker settings={settings} onChange={update} />
                <Pressable
                  accessibilityRole="button"
                  disabled={eligibleCount === 0}
                  onPress={onStudy}
                  className="items-center rounded-lg bg-primary py-3 disabled:opacity-50"
                >
                  <Text className="text-base font-semibold text-primary-foreground">Study</Text>
                </Pressable>
                {config && cards && eligibleCount === 0 ? (
                  <Text className="text-sm text-muted-foreground">
                    {noEligibleCardsMessage(config)}
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <CardRow card={item} config={config} />}
      />
    </Screen>
  )
}
