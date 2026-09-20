import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SaveStatusValue } from '@/hooks/useSaveStatus'

export function SaveStatus({ status, onRetry }: { status: SaveStatusValue; onRetry: () => void }) {
  return (
    <div className="min-h-5 text-xs">
      {status === 'saving' && <span className="text-muted-foreground">Saving…</span>}
      {status === 'saved' && (
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Check className="size-3.5" />
          Saved
        </span>
      )}
      {status === 'error' && (
        <span className="text-destructive flex items-center gap-1">
          Couldn't save
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onRetry}>
            Retry
          </Button>
        </span>
      )}
    </div>
  )
}
