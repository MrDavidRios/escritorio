import { Loader2, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
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
  const [open, setOpen] = useState(false)

  function handleOpenChange(next: boolean) {
    // Stay open (and keep focus here) until the delete has actually
    // finished; closing early hands focus back to a card about to vanish.
    if (!next && deleteCard.isPending) return
    if (next) deleteCard.reset()
    setOpen(next)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
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
        {deleteCard.isError && (
          <p role="alert" className="text-destructive text-sm">
            Couldn't delete this card. Try again.
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteCard.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteCard.isPending}
            onClick={(e) => {
              // Radix closes the dialog on action click by default.
              e.preventDefault()
              deleteCard.mutate(card, { onSuccess: () => setOpen(false) })
            }}
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
