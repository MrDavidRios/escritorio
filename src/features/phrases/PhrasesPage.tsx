import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DEFAULT_NEW_PHRASES_PER_DAY } from '@/api/userSettings'
import { useAuth } from '@/features/auth/AuthContext'
import { useSignedImageUrls } from '@/features/study-sets/hooks/useSignedImageUrls'
import type { Phrase } from '@/types/phrase'
import { dueToday, practiceSet } from './dailyQueue'
import { todayKey } from './dates'
import { forecast, FORECAST_DAYS, nextBusyDay } from './forecast'
import { NewPerDaySetting } from './NewPerDaySetting'
import { PhraseCalendar } from './PhraseCalendar'
import { PhraseFormDialog } from './PhraseFormDialog'
import { PhraseList } from './PhraseList'
import { TodayPanel } from './TodayPanel'
import { useCreatePhrase, useDeletePhrase, usePhrases, useUpdatePhrase } from './hooks/usePhrases'
import { useUpdateNewPhrasesPerDay, useUserSettings } from './hooks/useUserSettings'

const EMPTY_FORM = { spanish: '', english: '', example: '' }

export function PhrasesPage() {
  const { user } = useAuth()
  const ownerId = user!.id
  const today = todayKey()

  const { data: phrases, isLoading, isError } = usePhrases()
  const { data: settings, isError: settingsError } = useUserSettings()
  const cap = settings?.new_phrases_per_day ?? DEFAULT_NEW_PHRASES_PER_DAY
  // Wait for the real cap so counts never flash computed from the default.
  const ready = !!phrases && (!!settings || settingsError)

  const createPhrase = useCreatePhrase(ownerId)
  const updatePhrase = useUpdatePhrase(ownerId)
  const deletePhrase = useDeletePhrase()
  const updateCap = useUpdateNewPhrasesPerDay(ownerId)

  const queue = useMemo(
    () => (ready && phrases ? dueToday(phrases, today, cap) : null),
    [ready, phrases, today, cap],
  )
  const days = useMemo(
    () => (ready && phrases ? forecast(phrases, today, cap, FORECAST_DAYS) : []),
    [ready, phrases, today, cap],
  )
  const canPractice = useMemo(
    () => (phrases ? practiceSet(phrases, today).length > 0 : false),
    [phrases, today],
  )
  const newestFirst = useMemo(() => [...(phrases ?? [])].reverse(), [phrases])

  const imagePaths = useMemo(
    () => (phrases ?? []).flatMap((p) => (p.image_path ? [p.image_path] : [])),
    [phrases],
  )
  const { data: imageUrls } = useSignedImageUrls(imagePaths)

  const [editing, setEditing] = useState<Phrase | 'new' | null>(null)
  const editingPhrase = editing !== 'new' ? editing : null

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <Link to="/" className="text-muted-foreground text-sm underline underline-offset-4">
        ← Back to dashboard
      </Link>
      <h1 className="text-xl font-semibold">Phrases</h1>

      {(isLoading || (!!phrases && !ready)) && (
        <div className="bg-muted h-24 animate-pulse rounded-xl" />
      )}
      {isError && (
        <p className="text-destructive text-sm">
          Couldn't load your phrases. Refresh to try again.
        </p>
      )}

      {queue && phrases && phrases.length > 0 && (
        <TodayPanel
          reviewCount={queue.reviews.length}
          newCount={queue.fresh.length}
          next={nextBusyDay(days, today)}
          today={today}
          canPractice={canPractice}
        />
      )}

      {ready && phrases && (
        <Card>
          <CardContent>
            <PhraseCalendar days={days} today={today} />
          </CardContent>
        </Card>
      )}

      {ready && phrases && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Your phrases ({phrases.length})</h2>
            <div className="flex items-center gap-3">
              <NewPerDaySetting value={cap} onChange={(value) => updateCap.mutate(value)} />
              <Button size="sm" onClick={() => setEditing('new')}>
                <Plus data-icon="inline-start" />
                Add phrase
              </Button>
            </div>
          </div>
          <PhraseList
            phrases={newestFirst}
            imageUrls={imageUrls}
            today={today}
            onEdit={(phrase) => setEditing(phrase)}
          />
        </section>
      )}

      {editing && (
        <PhraseFormDialog
          key={editingPhrase?.id ?? 'new'}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
          title={editingPhrase ? 'Edit phrase' : 'Add phrase'}
          submitLabel={editingPhrase ? 'Save' : 'Add'}
          initial={
            editingPhrase
              ? {
                  spanish: editingPhrase.spanish,
                  english: editingPhrase.english,
                  example: editingPhrase.example ?? '',
                }
              : EMPTY_FORM
          }
          initialImageUrl={
            editingPhrase?.image_path ? (imageUrls[editingPhrase.image_path] ?? null) : null
          }
          onSubmit={async (values) => {
            if (editingPhrase) await updatePhrase.mutateAsync({ phrase: editingPhrase, ...values })
            else await createPhrase.mutateAsync(values)
            setEditing(null)
          }}
          onDelete={
            editingPhrase
              ? async () => {
                  await deletePhrase.mutateAsync(editingPhrase)
                  setEditing(null)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}
