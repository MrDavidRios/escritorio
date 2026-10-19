import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const MIN = 0
const MAX = 100

/** Commits on blur or Enter; an invalid entry snaps back to the saved value. */
export function NewPerDaySetting({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [syncedValue, setSyncedValue] = useState(value)
  if (value !== syncedValue) {
    setSyncedValue(value)
    setDraft(String(value))
  }

  function commit() {
    const parsed = Number(draft)
    if (draft.trim() === '' || !Number.isInteger(parsed) || parsed < MIN || parsed > MAX) {
      setDraft(String(value))
      return
    }
    if (parsed !== value) onChange(parsed)
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="new-per-day" className="text-muted-foreground font-normal">
        New phrases per day
      </Label>
      <Input
        id="new-per-day"
        type="number"
        inputMode="numeric"
        min={MIN}
        max={MAX}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
        }}
        className="w-20"
      />
    </div>
  )
}
