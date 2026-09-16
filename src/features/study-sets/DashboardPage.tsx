import { Loader2, Pencil, Play, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { CreateStudySetDialog } from './CreateStudySetDialog'
import { useStudySets } from './hooks/useStudySets'
import { StudySetThumbnail } from './StudySetThumbnail'

export function DashboardPage() {
  const { data: studySets, isLoading, isError, refetch, isRefetching } = useStudySets()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your study sets</h1>
        <CreateStudySetDialog />
      </div>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4">
                <div className="bg-muted size-16 shrink-0 animate-pulse rounded-lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="bg-muted h-4 w-1/3 animate-pulse rounded" />
                  <div className="bg-muted h-3 w-2/3 animate-pulse rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <div className="border-destructive/30 bg-destructive/5 flex flex-col items-start gap-2 rounded-lg border p-4">
          <p className="text-destructive text-sm">
            Couldn't load your study sets. Check your connection and try again.
          </p>
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

      {studySets && studySets.length === 0 && (
        <p className="text-muted-foreground">
          You don't have any study sets yet. Create one to get started.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {studySets?.map((studySet) => (
          <div
            key={studySet.id}
            className="group/row ease-out-strong after:ease-out-strong relative isolate rounded-xl transition-transform duration-200 after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-xl after:opacity-0 after:shadow-lg after:transition-opacity after:duration-200 hover:-translate-y-0.5 hover:after:opacity-100 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <Card>
              <CardContent className="flex items-center gap-4">
                <StudySetThumbnail studySet={studySet} />
                <div className="min-w-0 flex-1">
                  <CardTitle>{studySet.title}</CardTitle>
                  {studySet.description && (
                    <p className="text-muted-foreground mt-1 truncate text-sm">
                      {studySet.description}
                    </p>
                  )}
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  <Button asChild size="sm">
                    <Link to={`/sets/${studySet.id}/study`}>
                      <Play data-icon="inline-start" />
                      Study
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/sets/${studySet.id}/edit`}>
                      <Pencil data-icon="inline-start" />
                      Edit
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}
