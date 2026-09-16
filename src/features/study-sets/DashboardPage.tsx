import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateStudySetDialog } from './CreateStudySetDialog'
import { DeleteStudySetDialog } from './DeleteStudySetDialog'
import { useStudySets } from './hooks/useStudySets'

export function DashboardPage() {
  const { data: studySets, isLoading, isError, error } = useStudySets()

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your study sets</h1>
        <CreateStudySetDialog />
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {isError && (
        <p className="text-sm text-destructive">
          Failed to load study sets: {(error as Error).message}
        </p>
      )}

      {studySets && studySets.length === 0 && (
        <p className="text-muted-foreground">
          You don't have any study sets yet. Create one to get started.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {studySets?.map((studySet) => (
          <Card key={studySet.id}>
            <CardHeader>
              <CardTitle>{studySet.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              {studySet.description && (
                <p className="text-sm text-muted-foreground">{studySet.description}</p>
              )}
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
