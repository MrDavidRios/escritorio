import { ChevronDown, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  onModeChange,
  eligibleCount,
  totalCount,
  onStart,
}: {
  config: StudyConfig
  onChange: (config: StudyConfig) => void
  onModeChange: (mode: StudyMode) => void
  eligibleCount: number
  totalCount: number
  onStart: () => void
}) {
  const canStart = eligibleCount > 0
  const modeLabel = studyModeLabel(config.mode)
  const startLabel =
    eligibleCount === totalCount ? modeLabel : `${modeLabel} · ${eligibleCount} of ${totalCount} cards`
  const otherModes: StudyMode[] = (['conversion', 'meaning'] as StudyMode[]).filter(
    (mode) => mode !== config.mode,
  )

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex items-stretch">
        <Button size="lg" className="h-10 rounded-r-none" disabled={!canStart} onClick={onStart}>
          <Play data-icon="inline-start" />
          {startLabel}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="lg"
              className="-ml-px h-10 rounded-l-none border-l border-primary-foreground/10 px-2"
              disabled={!canStart}
              aria-label="Choose study mode"
            >
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-0">
            {otherModes.map((mode) => (
              <DropdownMenuItem key={mode} onSelect={() => onModeChange(mode)}>
                {studyModeLabel(mode)}
              </DropdownMenuItem>
            ))}
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
