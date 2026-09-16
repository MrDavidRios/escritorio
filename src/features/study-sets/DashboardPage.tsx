import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { CreateStudySetDialog } from './CreateStudySetDialog'
import { DeleteStudySetDialog } from './DeleteStudySetDialog'
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
                <div className="size-16 shrink-0 animate-pulse rounded-lg bg-muted" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            Couldn't load your study sets. Check your connection and try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
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
          <Card key={studySet.id}>
            <CardContent className="flex items-center gap-4">
              <StudySetThumbnail studySet={studySet} />
              <div className="min-w-0 flex-1">
                <CardTitle>{studySet.title}</CardTitle>
                {studySet.description && (
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {studySet.description}
                  </p>
                )}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to={`/sets/${studySet.id}/study`}>Study</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`/sets/${studySet.id}/edit`}>Edit</Link>
                </Button>
                <DeleteStudySetDialog
                  studySetId={studySet.id}
                  studySetTitle={studySet.title}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
