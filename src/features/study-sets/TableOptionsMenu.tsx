import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { LowercaseField } from './lowercaseCardFields'

const LOWERCASE_OPTIONS: { field: LowercaseField; label: string }[] = [
  { field: 'spanish_term', label: 'Lowercase Spanish words' },
  { field: 'english_equivalent', label: 'Lowercase English equivalents' },
  { field: 'definition', label: 'Lowercase definitions' },
]

interface TableOptionsMenuProps {
  selected: LowercaseField[]
  onChange: (selected: LowercaseField[]) => void
}

export function TableOptionsMenu({ selected, onChange }: TableOptionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="self-start">
          {selected.length > 0 ? `Options (${selected.length})` : 'Options'}
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {LOWERCASE_OPTIONS.map(({ field, label }) => (
          <DropdownMenuCheckboxItem
            key={field}
            checked={selected.includes(field)}
            onCheckedChange={(checked) =>
              onChange(checked ? [...selected, field] : selected.filter((f) => f !== field))
            }
            // Keep the menu open so several options can be ticked in one go.
            onSelect={(event) => event.preventDefault()}
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
