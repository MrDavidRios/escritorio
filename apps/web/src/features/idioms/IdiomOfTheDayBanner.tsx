import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { dayLabel, daysAgo as daysBetween, subtractDays } from './idiomOfTheDay'
import { IdiomOfTheDayCard } from './IdiomOfTheDayCard'
import { useIdiomOfTheDay } from './useIdiomOfTheDay'

/** How many days back the user can browse from today. */
const MAX_DAYS_BACK = 30

/** Dashboard banner. Stays out of the way: shows a skeleton while loading, nothing on failure. */
export function IdiomOfTheDayBanner() {
  const [daysAgo, setDaysAgo] = useState(0)
  const today = new Date()
  const selectedDate = subtractDays(today, daysAgo)
  const { idiom, isLoading } = useIdiomOfTheDay(selectedDate)

  if (isLoading) {
    return (
      <Card className="lg:h-40">
        <CardContent className="flex flex-col gap-2">
          <div className="bg-muted h-3 w-24 animate-pulse rounded" />
          <div className="bg-muted h-5 w-1/2 animate-pulse rounded" />
          <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  if (!idiom) return null
  return (
    <IdiomOfTheDayCard
      idiom={idiom}
      dateLabel={dayLabel(today, daysAgo)}
      selectedDate={selectedDate}
      minDate={subtractDays(today, MAX_DAYS_BACK)}
      maxDate={subtractDays(today, 0)}
      onSelectDate={(date) => setDaysAgo(daysBetween(today, date))}
      onPrevious={() => setDaysAgo((d) => Math.min(d + 1, MAX_DAYS_BACK))}
      onNext={() => setDaysAgo((d) => Math.max(d - 1, 0))}
    />
  )
}
