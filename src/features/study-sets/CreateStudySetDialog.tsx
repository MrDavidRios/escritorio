import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { GhostCardButton } from '@/components/GhostCardButton'
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
import { CreateFromTableForm } from './CreateFromTableForm'
import { useCreateStudySet, useCreateStudySetFromTable } from './hooks/useStudySets'
import { lowercaseCardFields, type LowercaseField } from './lowercaseCardFields'
import { parseCardTable } from './parseCardTable'
import { studySetSchema, type StudySetFormValues } from './studySetSchema'

export function CreateStudySetDialog() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'details' | 'table'>('details')
  const [table, setTable] = useState('')
  const [lowercaseFields, setLowercaseFields] = useState<LowercaseField[]>([])
  const parsed = useMemo(() => parseCardTable(table), [table])
  const navigate = useNavigate()
  const createStudySet = useCreateStudySet()
  const createFromTable = useCreateStudySetFromTable()
  const activeMutation = mode === 'table' ? createFromTable : createStudySet
  const cardCount = parsed.cards.length

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StudySetFormValues>({
    resolver: zodResolver(studySetSchema),
    defaultValues: { title: '', description: '' },
  })

  function resetDialog() {
    reset()
    setMode('details')
    setTable('')
    setLowercaseFields([])
    createFromTable.reset()
  }

  async function onSubmit(values: StudySetFormValues) {
    if (mode === 'table' && cardCount === 0) return
    const input = { title: values.title, description: values.description || null }
    const studySet =
      mode === 'table'
        ? await createFromTable.mutateAsync({
            ...input,
            cards: lowercaseCardFields(parsed.cards, lowercaseFields),
          })
        : await createStudySet.mutateAsync(input)
    setOpen(false)
    resetDialog()
    // Deliberately jump to the set's page (unlike Delete, which stays put) since working on the new set's cards is the owner's next move.
    navigate(`/sets/${studySet.id}`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) resetDialog()
      }}
    >
      <DialogTrigger asChild>
        <GhostCardButton>
          <Plus className="size-4" aria-hidden />
          New study set
        </GhostCardButton>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'table' ? 'New study set from table' : 'New study set'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register('title')} />
            {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
          </div>
          {mode === 'table' ? (
            <CreateFromTableForm
              value={table}
              onChange={setTable}
              parsed={parsed}
              lowercaseFields={lowercaseFields}
              onLowercaseFieldsChange={setLowercaseFields}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register('description')} />
            </div>
          )}
          {activeMutation.isError && (
            <p className="text-destructive text-sm">
              Couldn't create the study set. Please try again.
            </p>
          )}
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode(mode === 'table' ? 'details' : 'table')}
            >
              {mode === 'table' ? 'Back' : 'Create from table'}
            </Button>
            <Button type="submit" disabled={isSubmitting || (mode === 'table' && cardCount === 0)}>
              {isSubmitting && <Loader2 data-icon="inline-start" className="animate-spin" />}
              {isSubmitting
                ? 'Creating…'
                : mode === 'table'
                  ? `Create ${cardCount} ${cardCount === 1 ? 'card' : 'cards'}`
                  : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
