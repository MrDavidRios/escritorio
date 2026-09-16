import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useState, type ClipboardEvent, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { AccentedCharPad } from '@/components/AccentedCharPad'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCursorInsert } from '@/hooks/useCursorInsert'
import type { Card } from '@/types/card'
import { cardSchema, type CardFormValues } from './cardSchema'
import { useCreateCard, useUpdateCard } from './hooks/useCards'
import { ImageUploadField } from './ImageUploadField'

export function CardFormDialog({
  studySetId,
  ownerId,
  card,
  existingImageUrl,
  trigger,
}: {
  studySetId: string
  ownerId: string
  /** Omit to render an "add card" dialog instead of "edit card". */
  card?: Card
  existingImageUrl?: string
  trigger: ReactNode
}) {
  const isEdit = !!card
  const [open, setOpen] = useState(false)
  const [image, setImage] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)

  const createCard = useCreateCard(studySetId, ownerId)
  const updateCard = useUpdateCard(studySetId, ownerId)
  const mutation = isEdit ? updateCard : createCard

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: { hint: card?.hint ?? '', answer: card?.answer ?? '' },
  })

  const answerCursor = useCursorInsert(
    () => getValues('answer'),
    (next) => setValue('answer', next, { shouldDirty: true, shouldValidate: true }),
  )
  const { ref: registerAnswerRef, ...answerField } = register('answer')

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) {
      // Re-sync with the latest data each time the dialog opens, since a
      // list item's dialog stays mounted across re-renders.
      reset({ hint: card?.hint ?? '', answer: card?.answer ?? '' })
      setImage(null)
      setImageError(null)
    }
  }

  function handlePaste(e: ClipboardEvent) {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    if (!item) return // no image on the clipboard -- let normal text paste proceed
    const file = item.getAsFile()
    if (!file) return
    e.preventDefault()
    setImage(file)
    setImageError(null)
  }

  async function onSubmit(values: CardFormValues) {
    if (!isEdit && !image) {
      setImageError('An image is required')
      return
    }
    setImageError(null)

    if (isEdit) {
      await updateCard.mutateAsync({ card, image, hint: values.hint, answer: values.answer })
    } else {
      await createCard.mutateAsync({ image, hint: values.hint, answer: values.answer })
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit card' : 'Add card'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          onPaste={handlePaste}
          className="flex flex-col gap-4"
        >
          <ImageUploadField
            value={image}
            onChange={setImage}
            existingImageUrl={existingImageUrl}
            error={imageError ?? undefined}
          />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="answer">Answer</Label>
            <AccentedCharPad onInsert={answerCursor.insert} />
            <Input
              id="answer"
              {...answerField}
              ref={(el) => {
                registerAnswerRef(el)
                answerCursor.setRef(el)
              }}
            />
            {errors.answer && <p className="text-destructive text-sm">{errors.answer.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hint">Hint (optional)</Label>
            <Input id="hint" {...register('hint')} />
          </div>
          {mutation.isError && (
            <p className="text-destructive text-sm">{(mutation.error as Error).message}</p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 data-icon="inline-start" className="animate-spin" />}
              {isSubmitting ? 'Saving…' : isEdit ? 'Save' : 'Add card'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
