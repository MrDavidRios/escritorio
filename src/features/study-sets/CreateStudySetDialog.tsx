import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
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
import { Textarea } from '@/components/ui/textarea'
import { useCreateStudySet } from './hooks/useStudySets'
import { studySetSchema, type StudySetFormValues } from './studySetSchema'

export function CreateStudySetDialog() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const createStudySet = useCreateStudySet()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StudySetFormValues>({
    resolver: zodResolver(studySetSchema),
    defaultValues: { title: '', description: '' },
  })

  async function onSubmit(values: StudySetFormValues) {
    const studySet = await createStudySet.mutateAsync({
      title: values.title,
      description: values.description || null,
    })
    setOpen(false)
    reset()
    // Deliberately jump to the set's page (unlike Delete, which stays put) since a new set has no cards yet, so adding them is the owner's next move.
    navigate(`/sets/${studySet.id}`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="ease-out-strong after:ease-out-strong border-foreground/20 text-muted-foreground hover:border-foreground/40 hover:bg-muted/50 hover:text-foreground focus-visible:ring-ring/50 relative isolate flex min-h-24 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium transition-[translate,color,background-color,border-color] duration-200 outline-none after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-xl after:opacity-0 after:shadow-lg after:transition-opacity after:duration-200 hover:-translate-y-0.5 hover:after:opacity-100 focus-visible:ring-3 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <Plus className="size-4" aria-hidden />
          New study set
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New study set</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register('title')} />
            {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register('description')} />
          </div>
          {createStudySet.isError && (
            <p className="text-destructive text-sm">
              Couldn't create the study set. Please try again.
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 data-icon="inline-start" className="animate-spin" />}
              {isSubmitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
