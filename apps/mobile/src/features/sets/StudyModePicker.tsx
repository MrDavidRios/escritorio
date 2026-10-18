import {
  studyModeLabel,
  type ConversionDirection,
  type MeaningVisibility,
  type StudyMode,
} from '@escritorio/core'
import { Pressable, Text, View } from 'react-native'
import type { StudySettings } from '@escritorio/core'

type Option<T extends string> = { value: T; label: string }

const MODE_OPTIONS: Option<StudyMode>[] = [
  { value: 'conversion', label: studyModeLabel('conversion') },
  { value: 'meaning', label: studyModeLabel('meaning') },
]

// Same options and copy as the web picker (apps/web/.../StudyModePicker.tsx).
const DIRECTION_OPTIONS: Option<ConversionDirection>[] = [
  { value: 'en_es', label: 'English → Spanish' },
  { value: 'es_en', label: 'Spanish → English' },
  { value: 'random', label: 'Random' },
]

const VISIBILITY_OPTIONS: Option<MeaningVisibility>[] = [
  { value: 'image', label: 'Show image' },
  { value: 'definition', label: 'Show definition' },
  { value: 'both', label: 'Show both' },
]

function Segmented<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: Option<T>[]
  value: T
  onSelect: (value: T) => void
}) {
  return (
    <View className="flex-row rounded-lg bg-muted p-1">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) onSelect(option.value)
            }}
            className={`flex-1 items-center justify-center rounded-md px-1 py-2 ${selected ? 'bg-background' : ''}`}
          >
            <Text
              className={`text-center text-sm ${selected ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function StudyModePicker({
  settings,
  onChange,
}: {
  settings: StudySettings
  onChange: (patch: Partial<StudySettings>) => void
}) {
  return (
    <View className="gap-2">
      <Segmented
        options={MODE_OPTIONS}
        value={settings.study_mode}
        onSelect={(study_mode) => onChange({ study_mode })}
      />
      {settings.study_mode === 'conversion' ? (
        <Segmented
          options={DIRECTION_OPTIONS}
          value={settings.conversion_direction}
          onSelect={(conversion_direction) => onChange({ conversion_direction })}
        />
      ) : (
        <Segmented
          options={VISIBILITY_OPTIONS}
          value={settings.meaning_visibility}
          onSelect={(meaning_visibility) => onChange({ meaning_visibility })}
        />
      )}
    </View>
  )
}
