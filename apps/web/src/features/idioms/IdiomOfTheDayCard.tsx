import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { Idiom } from '@/types/idiom'

/** Wiktionary credit. CC BY-SA requires naming the source and linking the licence. */
function Source({ idiom, className }: { idiom: Idiom; className?: string }) {
  return (
    <p className={cn('text-muted-foreground text-xs', className)}>
      <a
        href={idiom.source_url}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        Wiktionary
      </a>
      {' · '}
      <a
        href="https://creativecommons.org/licenses/by-sa/4.0/"
        target="_blank"
        rel="noreferrer"
        title="Creative Commons Attribution-ShareAlike 4.0"
        className="underline underline-offset-2"
      >
        CC BY-SA
      </a>
    </p>
  )
}

export function IdiomOfTheDayCard({
  idiom,
  dateLabel,
  selectedDate,
  minDate,
  maxDate,
  onSelectDate,
  onPrevious,
  onNext,
}: {
  idiom: Idiom
  dateLabel: string
  selectedDate: Date
  minDate: Date
  maxDate: Date
  onSelectDate: (date: Date) => void
  onPrevious: () => void
  onNext: () => void
}) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const canGoPrevious = selectedDate > minDate
  const canGoNext = selectedDate < maxDate

  return (
    <Card className="lg:h-40 lg:py-0">
      <CardContent className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-2 lg:h-full lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] lg:grid-rows-[auto_minmax(0,1fr)] lg:gap-x-10 lg:gap-y-1 lg:px-8 lg:py-5">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase lg:col-start-1 lg:row-start-1">
          Idiom of the day
        </p>
        <div className="flex flex-col items-end gap-2 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:justify-between lg:self-stretch">
          <div className="-my-1 flex items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Previous idiom"
              disabled={!canGoPrevious}
              onClick={onPrevious}
            >
              <ChevronLeft />
            </Button>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Choose date, currently ${dateLabel}`}
                  className="text-muted-foreground text-xs font-medium"
                >
                  <CalendarDays data-icon="inline-start" />
                  {dateLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="single"
                  required
                  selected={selectedDate}
                  defaultMonth={selectedDate}
                  startMonth={minDate}
                  endMonth={maxDate}
                  disabled={{ before: minDate, after: maxDate }}
                  onSelect={(date) => {
                    onSelectDate(date)
                    setCalendarOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Next idiom"
              disabled={!canGoNext}
              onClick={onNext}
            >
              <ChevronRight />
            </Button>
          </div>
          <Source idiom={idiom} className="hidden lg:block" />
        </div>
        <div aria-live="polite" className="contents">
          <p
            lang="es"
            className="font-heading col-span-2 text-xl leading-snug font-medium text-balance lg:col-span-1 lg:col-start-1 lg:row-start-2 lg:line-clamp-2 lg:min-h-0 lg:text-4xl lg:leading-tight lg:tracking-tight"
            title={idiom.spanish}
          >
            {idiom.spanish}
          </p>
          <div className="col-span-2 flex flex-col gap-1 lg:col-span-1 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-h-full lg:overflow-y-auto lg:border-l lg:pl-10">
            <p className="lg:text-base">{idiom.english}</p>
            {idiom.example && (
              <p lang="es" className="text-muted-foreground italic">
                {idiom.example}
              </p>
            )}
            <Source idiom={idiom} className="lg:hidden" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
