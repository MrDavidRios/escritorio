import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardTitle } from '@/components/ui/card'

/** Dashboard entry to /phrases. `dueCount` is null while loading. */
export function PhrasesTile({ dueCount }: { dueCount: number | null }) {
  return (
    <Link
      to="/phrases"
      className="group/row ease-out-strong after:ease-out-strong relative isolate block rounded-xl transition-transform duration-200 after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-xl after:opacity-0 after:shadow-lg after:transition-opacity after:duration-200 hover:-translate-y-0.5 hover:after:opacity-100 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <Card>
        <CardContent className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle>Phrases</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              {dueCount === null
                ? 'Loading…'
                : dueCount === 0
                  ? 'All caught up today'
                  : `${dueCount} due today`}
            </p>
          </div>
          <ChevronRight aria-hidden className="text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </Link>
  )
}
