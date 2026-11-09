import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { LowercaseField } from './lowercaseCardFields'
import type { MissingColumn, ParsedCardTable } from './parseCardTable'
import { TableOptionsMenu } from './TableOptionsMenu'

function describeMissingColumns(missing: MissingColumn[]) {
  if (missing.length > 1) {
    return 'Add a header row with a Spanish column and an English or definition column.'
  }
  return missing[0] === 'spanish'
    ? 'Add a Spanish column to the header row.'
    : 'Add an English or definition column to the header row.'
}

function describeCount({ cards, skipped }: ParsedCardTable) {
  const found = `${cards.length} ${cards.length === 1 ? 'word' : 'words'} found`
  return skipped > 0 ? `${found}, ${skipped} skipped` : found
}

interface CreateFromTableFormProps {
  value: string
  onChange: (value: string) => void
  parsed: ParsedCardTable
  lowercaseFields: LowercaseField[]
  onLowercaseFieldsChange: (fields: LowercaseField[]) => void
}

export function CreateFromTableForm({
  value,
  onChange,
  parsed,
  lowercaseFields,
  onLowercaseFieldsChange,
}: CreateFromTableFormProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="table">Paste your table</Label>
      <Textarea
        id="table"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-sizing-fixed h-40 resize-none whitespace-pre"
      />
      <TableOptionsMenu selected={lowercaseFields} onChange={onLowercaseFieldsChange} />
      {parsed.missingColumns.length > 0 ? (
        <p className="text-destructive text-sm">{describeMissingColumns(parsed.missingColumns)}</p>
      ) : (
        value.trim() && <p className="text-muted-foreground text-sm">{describeCount(parsed)}</p>
      )}
    </div>
  )
}
