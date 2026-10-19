import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { extractPastedImageFile } from '@/features/study-sets/imageDrop'
import { PhraseImageField } from './PhraseImageField'
import { phraseSchema, type PhraseFormValues } from './phraseSchema'

export interface PhraseFormSubmit extends PhraseFormValues {
  image: File | null
  removeImage: boolean
}

/**
 * Add/edit a phrase. Mount fresh per phrase (parent keys it) so the form
 * starts from `initial`. Pass `onDelete` to show the delete action.
 */
export function PhraseFormDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  initial,
  initialImageUrl,
  onSubmit,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel: string
  initial: PhraseFormValues
  initialImageUrl: string | null
  onSubmit: (values: PhraseFormSubmit) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PhraseFormValues>({ resolver: zodResolver(phraseSchema), defaultValues: initial })

  const [picked, setPicked] = useState<{ file: File; url: string } | null>(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Revoke the preview URL when it is replaced or the dialog unmounts.
  useEffect(() => {
    if (!picked) return
    return () => URL.revokeObjectURL(picked.url)
  }, [picked])

  const image = picked?.file ?? null
  const previewUrl = picked ? picked.url : removeImage ? null : initialImageUrl

  function pick(file: File) {
    setPicked({ file, url: URL.createObjectURL(file) })
    setRemoveImage(false)
  }

  async function submit(values: PhraseFormValues) {
    setError(null)
    try {
      await onSubmit({ ...values, image, removeImage })
    } catch {
      setError("Couldn't save the phrase. Please try again.")
    }
  }

  async function confirmDelete() {
    if (!onDelete) return
    setDeleting(true)
    setError(null)
    try {
      await onDelete()
    } catch {
      setError("Couldn't delete the phrase. Please try again.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPaste={(e) => {
          const file = extractPastedImageFile(e)
          if (file) pick(file)
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phrase-spanish">Spanish</Label>
            <Input id="phrase-spanish" lang="es" autoComplete="off" {...register('spanish')} />
            {errors.spanish && <p className="text-destructive text-sm">{errors.spanish.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phrase-english">English meaning</Label>
            <Input id="phrase-english" autoComplete="off" {...register('english')} />
            {errors.english && <p className="text-destructive text-sm">{errors.english.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phrase-example">Example (optional)</Label>
            <Textarea id="phrase-example" lang="es" rows={2} {...register('example')} />
            {errors.example && <p className="text-destructive text-sm">{errors.example.message}</p>}
          </div>
          <PhraseImageField
            previewUrl={previewUrl}
            onPick={pick}
            onRemove={() => {
              setPicked(null)
              setRemoveImage(true)
            }}
          />
          {error && <p className="text-destructive text-sm">{error}</p>}
          <DialogFooter className="sm:justify-between">
            {onDelete ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive"
                    disabled={deleting}
                  >
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this phrase?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Its review history and schedule are deleted too. This can't be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={isSubmitting || deleting}>
              {isSubmitting && <Loader2 data-icon="inline-start" className="animate-spin" />}
              {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
