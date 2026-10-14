import { useMemo, useState, type ComponentProps } from 'react'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import { localDateKey } from '@/features/idioms/idiomOfTheDay'
import type { DateKey } from '@/types/phrase'
import { longDate, parseDateKey } from './dates'
import type { ForecastDay } from './forecast'

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** Upcoming due counts per day. A forecast: past days show nothing. */
export function PhraseCalendar({ days, today }: { days: ForecastDay[]; today: DateKey }) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])
  const [selected, setSelected] = useState<DateKey>(today)
  const lastDay = days.at(-1)?.date ?? today

  // Stable per forecast so react-day-picker doesn't remount every day cell
  // on unrelated re-renders.
  const DayButton = useMemo(
    () =>
      function ForecastDayButton(props: ComponentProps<typeof CalendarDayButton>) {
        const day = byDate.get(localDateKey(props.day.date))
        const total = day ? day.reviews + day.newPhrases : 0
        return (
          <CalendarDayButton {...props}>
            {props.children}
            {total > 0 && (
              <span>
                {total}
                <span className="sr-only"> due</span>
              </span>
            )}
          </CalendarDayButton>
        )
      },
    [byDate],
  )

  const selectedDay = byDate.get(selected)

  return (
    <div className="flex flex-col items-center gap-3">
      <Calendar
        mode="single"
        required
        selected={parseDateKey(selected)}
        defaultMonth={parseDateKey(today)}
        startMonth={parseDateKey(today)}
        endMonth={parseDateKey(lastDay)}
        disabled={{ before: parseDateKey(today), after: parseDateKey(lastDay) }}
        onSelect={(date) => setSelected(localDateKey(date))}
        components={{ DayButton }}
        className="[--cell-size:--spacing(10)]"
      />
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {longDate(selected)} —{' '}
        {selectedDay && selectedDay.reviews + selectedDay.newPhrases > 0
          ? `${plural(selectedDay.reviews, 'review')}, ${selectedDay.newPhrases} new`
          : 'nothing due'}
      </p>
    </div>
  )
}
