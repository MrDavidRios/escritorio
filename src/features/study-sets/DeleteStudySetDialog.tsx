import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useDeleteStudySet } from './hooks/useStudySets'

export function DeleteStudySetDialog({
  studySetId,
  studySetTitle,
  onDeleted,
}: {
  studySetId: string
  studySetTitle: string
  onDeleted?: () => void
}) {
  const deleteStudySet = useDeleteStudySet()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{studySetTitle}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the study set and all of its cards.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              await deleteStudySet.mutateAsync(studySetId)
              onDeleted?.()
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
