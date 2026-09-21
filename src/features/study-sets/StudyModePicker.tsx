import { ChevronDown, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { StudyConfig } from '@/features/study/studyMode'
import { studyModeLabel } from '@/features/study/studyMode'
import type { ConversionDirection, MeaningVisibility, StudyMode } from '@/types/studySet'

const DIRECTION_OPTIONS: { value: ConversionDirection; label: string }[] = [
  { value: 'en_es', label: 'English → Spanish' },
  { value: 'es_en', label: 'Spanish → English' },
  { value: 'random', label: 'Random' },
]

const VISIBILITY_OPTIONS: { value: MeaningVisibility; label: string }[] = [
  { value: 'image', label: 'Show image' },
  { value: 'definition', label: 'Show definition' },
  { value: 'both', label: 'Show both' },
]

export function StudyModePicker({
  config,
  onChange,
  eligibleCount,
  totalCount,
  onStart,
}: {
  config: StudyConfig
  onChange: (config: StudyConfig) => void
  eligibleCount: number
  totalCount: number
  onStart: () => void
}) {
  function selectMode(mode: StudyMode) {
    if (mode === config.mode) return
    onChange(
      mode === 'conversion'
        ? { mode: 'conversion', direction: 'en_es' }
        : { mode: 'meaning', visibility: 'both' },
    )
  }

  const canStart = eligibleCount > 0
  const startLabel =
    eligibleCount === totalCount
      ? 'Start studying'
      : `Start studying · ${eligibleCount} of ${totalCount} cards`

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex items-stretch gap-0.5">
        <Button size="lg" className="h-10 rounded-r-none" disabled={!canStart} onClick={onStart}>
          <Play data-icon="inline-start" />
          {startLabel}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              variant="outline"
              className="h-10 rounded-l-none border-l-0 px-2"
              aria-label="Choose study mode"
            >
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={config.mode}
              onValueChange={(value) => selectMode(value as StudyMode)}
            >
              <DropdownMenuRadioItem value="conversion">
                {studyModeLabel('conversion')}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="meaning">
                {studyModeLabel('meaning')}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {config.mode === 'conversion' ? (
        <ToggleGroup
          type="single"
          value={config.direction}
          onValueChange={(value) => {
            if (value) onChange({ mode: 'conversion', direction: value as ConversionDirection })
          }}
        >
          {DIRECTION_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : (
        <ToggleGroup
          type="single"
          value={config.visibility}
          onValueChange={(value) => {
            if (value) onChange({ mode: 'meaning', visibility: value as MeaningVisibility })
          }}
        >
          {VISIBILITY_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      {!canStart && (
        <p className="text-muted-foreground text-xs sm:text-right">
          No cards are eligible for this mode/setting — try a different one.
        </p>
      )}
    </div>
  )
}
