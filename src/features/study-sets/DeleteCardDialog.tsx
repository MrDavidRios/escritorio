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
import type { Card } from '@/types/card'
import { useDeleteCard } from './hooks/useCards'

export function DeleteCardDialog({
  studySetId,
  card,
  trigger,
}: {
  studySetId: string
  card: Card
  trigger?: ReactNode
}) {
  const deleteCard = useDeleteCard(studySetId)

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
          <AlertDialogTitle>Delete this card?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the card and its image. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteCard.isPending}
            onClick={() => deleteCard.mutate(card)}
          >
            {deleteCard.isPending ? (
              <Loader2 data-icon="inline-start" className="animate-spin" />
            ) : (
              <Trash2 data-icon="inline-start" />
            )}
            {deleteCard.isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
