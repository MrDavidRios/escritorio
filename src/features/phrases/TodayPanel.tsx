import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { DateKey } from '@/types/phrase'
import { relativeDayLabel } from './dates'
import type { ForecastDay } from './forecast'

export function TodayPanel({
  reviewCount,
  newCount,
  next,
  today,
  canPractice,
}: {
  reviewCount: number
  newCount: number
  next: ForecastDay | null
  today: DateKey
  canPractice: boolean
}) {
  const total = reviewCount + newCount

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {total > 0 ? (
          <>
            <div>
              <p className="text-2xl font-semibold">{total} due today</p>
              {newCount > 0 && <p className="text-muted-foreground text-sm">{newCount} new</p>}
            </div>
            <Button asChild size="lg">
              <Link to="/phrases/review">Start</Link>
            </Button>
          </>
        ) : (
          <>
            <div>
              <p className="text-lg font-semibold">All caught up.</p>
              {next && (
                <p className="text-muted-foreground text-sm">
                  Next {next.reviews + next.newPhrases} due {relativeDayLabel(next.date, today)}.
                </p>
              )}
            </div>
            {canPractice && (
              <div className="flex flex-col items-start gap-1 sm:items-end">
                <Button asChild variant="outline">
                  <Link to="/phrases/practice">Practice anyway</Link>
                </Button>
                <p className="text-muted-foreground text-xs">
                  Practice doesn't change your schedule.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
