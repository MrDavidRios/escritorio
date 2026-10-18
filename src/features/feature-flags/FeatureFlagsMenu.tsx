import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { FeatureFlag } from './flags'

export interface FlagRow {
  flag: FeatureFlag
  label: string
  /** The database value; null while it's loading or couldn't be fetched. */
  dbOn: boolean | null
  override: boolean | undefined
}

type Choice = 'default' | 'on' | 'off'

function toChoice(override: boolean | undefined): Choice {
  if (override === undefined) return 'default'
  return override ? 'on' : 'off'
}

function fromChoice(choice: string): boolean | null {
  if (choice === 'on') return true
  if (choice === 'off') return false
  return null
}

/** Dev-only menu for overriding feature flags in this browser. */
export function FeatureFlagsMenu({
  rows,
  onOverride,
}: {
  rows: FlagRow[]
  onOverride: (flag: FeatureFlag, value: boolean | null) => void
}) {
  const overridden = rows.some((row) => row.override !== undefined)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={overridden ? 'secondary' : 'ghost'} size="sm">
          <Flag data-icon="inline-start" />
          {overridden ? 'Flags (overridden)' : 'Flags'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {rows.map((row) => (
          <div key={row.flag} className="py-1">
            <p className="text-muted-foreground px-2 py-1 text-xs font-medium">{row.label}</p>
            <DropdownMenuRadioGroup
              value={toChoice(row.override)}
              onValueChange={(choice) => onOverride(row.flag, fromChoice(choice))}
            >
              <DropdownMenuRadioItem value="default">
                {`Default (${row.dbOn === null ? 'unknown' : row.dbOn ? 'on' : 'off'})`}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="on">On</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="off">Off</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
