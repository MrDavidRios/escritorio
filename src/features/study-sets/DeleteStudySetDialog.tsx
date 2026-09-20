import { Loader2, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
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
  trigger,
}: {
  studySetId: string
  studySetTitle: string
  onDeleted?: () => void
  trigger?: ReactNode
}) {
  const deleteStudySet = useDeleteStudySet()

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button variant="destructive" size="sm">
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{studySetTitle}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the study set and all of its cards. This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteStudySet.isPending}
            onClick={async (e) => {
              e.preventDefault()
              await deleteStudySet.mutateAsync(studySetId)
              onDeleted?.()
            }}
          >
            {deleteStudySet.isPending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Trash2 data-icon="inline-start" />
            )}
            {deleteStudySet.isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
