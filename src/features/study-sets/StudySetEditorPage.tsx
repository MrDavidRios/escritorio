import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CardsSection } from './CardsSection'
import { DeleteStudySetDialog } from './DeleteStudySetDialog'
import { useSignedImageUrls } from './hooks/useSignedImageUrls'
import { useStudySet, useUpdateStudySet } from './hooks/useStudySets'
import { ImageUploadField } from './ImageUploadField'
import { studySetSchema, type StudySetFormValues } from './studySetSchema'

export function StudySetEditorPage() {
  const { setId } = useParams<{ setId: string }>()
  const navigate = useNavigate()
  const { data: studySet, isLoading, isError, error } = useStudySet(setId)
  const updateStudySet = useUpdateStudySet(setId!)
  const [image, setImage] = useState<File | null>(null)

  const existingImagePaths = studySet?.image_path ? [studySet.image_path] : []
  const existingImageUrls = useSignedImageUrls(existingImagePaths)
  const existingImageUrl = studySet?.image_path
    ? existingImageUrls.data?.[studySet.image_path]
    : undefined

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<StudySetFormValues>({
    resolver: zodResolver(studySetSchema),
    defaultValues: { title: '', description: '' },
  })

  useEffect(() => {
    if (studySet) {
      reset({ title: studySet.title, description: studySet.description ?? '' })
      setImage(null)
    }
  }, [studySet, reset])

  if (!setId) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(values: StudySetFormValues) {
    const updated = await updateStudySet.mutateAsync({
      title: values.title,
      description: values.description || null,
      image,
      currentImagePath: studySet!.image_path,
    })
    reset({ title: updated.title, description: updated.description ?? '' })
    setImage(null)
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <Link to="/" className="text-muted-foreground text-sm underline underline-offset-4">
        ← Back to study sets
      </Link>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {isError && (
        <p className="text-destructive text-sm">
          Failed to load study set: {(error as Error).message}
        </p>
      )}

      {studySet && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Edit study set</h1>
            <DeleteStudySetDialog
              studySetId={studySet.id}
              studySetTitle={studySet.title}
              onDeleted={() => navigate('/')}
            />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <ImageUploadField
              value={image}
              onChange={setImage}
              existingImageUrl={existingImageUrl}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register('title')} />
              {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register('description')} />
            </div>
            {updateStudySet.isError && (
              <p className="text-destructive text-sm">{(updateStudySet.error as Error).message}</p>
            )}
            <div>
              <Button type="submit" disabled={isSubmitting || (!isDirty && !image)}>
                {isSubmitting && <Loader2 data-icon="inline-start" className="animate-spin" />}
                {isSubmitting ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>

          <div className="border-t pt-4">
            <CardsSection studySetId={studySet.id} />
          </div>
        </>
      )}
    </div>
  )
}
