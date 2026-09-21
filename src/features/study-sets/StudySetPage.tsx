import { ImageIcon, Loader2, Play, RefreshCw } from 'lucide-react'
import { useRef } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { InlineText } from '@/components/InlineText'
import { SaveStatus } from '@/components/SaveStatus'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthContext'
import type { StudyConfig } from '@/features/study/studyMode'
import { eligibleCards } from '@/features/study/studyMode'
import { useSaveStatus } from '@/hooks/useSaveStatus'
import type { StudySet } from '@/types/studySet'
import { CardsSection } from './CardsSection'
import { DeleteStudySetDialog } from './DeleteStudySetDialog'
import { useCards } from './hooks/useCards'
import { useSignedImageUrls } from './hooks/useSignedImageUrls'
import { usePatchStudySet, useStudySet, useUpdateStudySet } from './hooks/useStudySets'
import { StudyModePicker } from './StudyModePicker'

const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function relativeTime(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (Math.abs(diffDays) < 1) {
    const diffHours = Math.round(diffMs / (1000 * 60 * 60))
    if (diffHours === 0) return 'just now'
    return relativeTimeFormatter.format(diffHours, 'hour')
  }
  return relativeTimeFormatter.format(diffDays, 'day')
}

function configFromStudySet(studySet: StudySet): StudyConfig {
  return studySet.study_mode === 'conversion'
    ? { mode: 'conversion', direction: studySet.conversion_direction }
    : { mode: 'meaning', visibility: studySet.meaning_visibility }
}

export function StudySetPage() {
  const { setId } = useParams<{ setId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: studySet, isLoading, isError, refetch, isRefetching } = useStudySet(setId)
  const { data: cards } = useCards(setId)
  const patchStudySet = usePatchStudySet(setId ?? '')
  const updateStudySet = useUpdateStudySet(setId ?? '')
  const saveStatus = useSaveStatus()
  const coverInputRef = useRef<HTMLInputElement>(null)

  const coverPaths = studySet?.image_path ? [studySet.image_path] : []
  const { data: coverUrls } = useSignedImageUrls(coverPaths)
  const coverUrl = studySet?.image_path ? coverUrls?.[studySet.image_path] : undefined

  if (!setId) {
    return <Navigate to="/" replace />
  }

  function patch(values: { title?: string; description?: string }) {
    if (!studySet) return
    saveStatus.setSaving()
    patchStudySet.mutate(
      'title' in values ? { title: values.title } : { description: values.description || null },
      {
        onSuccess: saveStatus.setSaved,
        onError: () => saveStatus.setError(() => patch(values)),
      },
    )
  }

  function replaceCover(file: File) {
    if (!studySet) return
    saveStatus.setSaving()
    updateStudySet.mutate(
      {
        title: studySet.title,
        description: studySet.description,
        image: file,
        currentImagePath: studySet.image_path,
      },
      {
        onSuccess: saveStatus.setSaved,
        onError: () => saveStatus.setError(() => replaceCover(file)),
      },
    )
  }

  function handleBandPaste(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    const file = item?.getAsFile()
    if (!file) return
    e.preventDefault()
    replaceCover(file)
  }

  const cardCount = cards?.length ?? 0

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 lg:p-8">
      <Link to="/" className="text-muted-foreground w-fit text-sm underline underline-offset-4">
        ← Back to study sets
      </Link>

      {isLoading && (
        <div className="flex flex-col gap-6">
          <div className="flex items-end gap-6 border-b pb-6">
            <div className="bg-muted size-28 shrink-0 animate-pulse rounded-xl" />
            <div className="flex flex-1 flex-col gap-3">
              <div className="bg-muted h-8 w-1/2 animate-pulse rounded" />
              <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
              <div className="bg-muted h-3 w-1/3 animate-pulse rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-muted aspect-[4/3] w-full animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div className="border-destructive/30 bg-destructive/5 flex flex-col items-start gap-2 rounded-lg border p-4">
          <p className="text-destructive text-sm">Couldn't load this study set.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            {isRefetching ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            {isRefetching ? 'Retrying…' : 'Try again'}
          </Button>
        </div>
      )}

      {studySet && (
        <>
          <div
            className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-4 gap-y-1 border-b pb-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-6"
            onPaste={handleBandPaste}
          >
            <div className="group/cover relative col-start-1 row-start-1 size-20 self-end sm:row-span-3 sm:size-28">
              <button
                type="button"
                aria-label="Change cover image"
                onClick={() => coverInputRef.current?.click()}
                className="bg-muted/50 ring-foreground/10 relative size-full overflow-hidden rounded-xl ring-1"
              >
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <ImageIcon className="text-muted-foreground size-6" />
                  </div>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-sm font-medium text-white opacity-0 transition-opacity duration-150 group-focus-within/cover:opacity-100 group-hover/cover:opacity-100 [@media(hover:none)]:bg-black/35 [@media(hover:none)]:opacity-100">
                  Change
                </span>
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) replaceCover(file)
                }}
              />
            </div>

            <InlineText
              value={studySet.title}
              onSave={(title) => patch({ title })}
              placeholder="Untitled study set"
              label="Study set title"
              as="h1"
              required
              className="col-start-2 row-start-1 self-end text-3xl font-semibold tracking-tight"
            />

            <InlineText
              value={studySet.description ?? ''}
              onSave={(description) => patch({ description })}
              placeholder="Add a description"
              label="Study set description"
              as="p"
              multiline
              className="text-muted-foreground col-span-2 row-start-2 sm:col-span-1 sm:col-start-2"
            />

            <p className="text-muted-foreground col-span-2 row-start-3 mt-2 text-sm sm:col-span-1 sm:col-start-2">
              {cardCount === 1 ? '1 card' : `${cardCount} cards`} · edited{' '}
              {relativeTime(studySet.updated_at)}
            </p>

            <div className="col-span-2 row-start-4 mt-4 flex flex-col items-stretch gap-2 sm:col-span-1 sm:col-start-3 sm:row-span-3 sm:row-start-1 sm:mt-0 sm:items-end sm:self-end">
              <SaveStatus status={saveStatus.status} onRetry={saveStatus.retry} />
              {cardCount === 0 ? (
                <>
                  <Button size="lg" disabled className="h-10">
                    <Play data-icon="inline-start" />
                    Start studying
                  </Button>
                  <p className="text-muted-foreground text-xs sm:text-right">
                    Add a card to start studying.
                  </p>
                </>
              ) : (
                <StudyModePicker
                  config={configFromStudySet(studySet)}
                  onChange={(config) => {
                    saveStatus.setSaving()
                    const patch =
                      config.mode === 'conversion'
                        ? { study_mode: 'conversion' as const, conversion_direction: config.direction }
                        : { study_mode: 'meaning' as const, meaning_visibility: config.visibility }
                    patchStudySet.mutate(patch, {
                      onSuccess: saveStatus.setSaved,
                      onError: () => saveStatus.setError(() => patchStudySet.mutate(patch)),
                    })
                  }}
                  eligibleCount={eligibleCards(cards ?? [], configFromStudySet(studySet)).length}
                  totalCount={cardCount}
                  onStart={() => navigate(`/sets/${setId}/study`)}
                />
              )}
            </div>
          </div>

          {user && (
            <CardsSection
              studySetId={studySet.id}
              ownerId={user.id}
              config={configFromStudySet(studySet)}
              onSaving={saveStatus.setSaving}
              onSaved={saveStatus.setSaved}
              onError={saveStatus.setError}
            />
          )}

          <div className="flex justify-end">
            <DeleteStudySetDialog
              studySetId={studySet.id}
              studySetTitle={studySet.title}
              onDeleted={() => navigate('/')}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                >
                  Delete this study set
                </Button>
              }
            />
          </div>
        </>
      )}
    </div>
  )
}
