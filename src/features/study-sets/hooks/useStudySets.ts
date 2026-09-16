import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteCardImages } from '@/api/cardImages'
import { listCards } from '@/api/cards'
import {
  createStudySet,
  deleteStudySet,
  getStudySet,
  listStudySets,
  updateStudySet,
} from '@/api/studySets'
import {
  deleteStudySetImages,
  studySetImagePath,
  uploadStudySetImage,
} from '@/api/studySetImages'
import { useAuth } from '@/features/auth/AuthContext'
import type { StudySetInput } from '@/types/studySet'

export function studySetsKey() {
  return ['study-sets'] as const
}

export function studySetKey(id: string) {
  return ['study-set', id] as const
}

export function useStudySets() {
  return useQuery({
    queryKey: studySetsKey(),
    queryFn: listStudySets,
  })
}

export function useStudySet(id: string | undefined) {
  return useQuery({
    queryKey: studySetKey(id ?? ''),
    queryFn: () => getStudySet(id!),
    enabled: !!id,
  })
}

export function useCreateStudySet() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (input: StudySetInput) => createStudySet(user!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studySetsKey() })
    },
  })
}

export interface StudySetFormInput {
  title: string
  description: string | null
  image: File | null
  currentImagePath: string | null
}

export function useUpdateStudySet(id: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      title,
      description,
      image,
      currentImagePath,
    }: StudySetFormInput) => {
      let imagePath = currentImagePath

      if (image) {
        const newPath = studySetImagePath(user!.id, id, image.name)
        if (newPath === currentImagePath) {
          // Same extension: overwrite in place.
          await uploadStudySetImage(newPath, image, { upsert: true })
        } else {
          await uploadStudySetImage(newPath, image)
          if (currentImagePath) {
            await deleteStudySetImages([currentImagePath]).catch(() => {})
          }
          imagePath = newPath
        }
      }

      return updateStudySet(id, { title, description, image_path: imagePath })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: studySetsKey() })
      queryClient.setQueryData(studySetKey(id), data)
    },
  })
}

export function useDeleteStudySet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // The DB cascade removes card rows, but not their storage objects --
      // clean those up first, or a deleted set leaves orphaned images.
      const studySet = await getStudySet(id)
      const cards = await listCards(id)
      await deleteCardImages(cards.map((card) => card.image_path))
      if (studySet.image_path) {
        await deleteStudySetImages([studySet.image_path])
      }
      await deleteStudySet(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studySetsKey() })
    },
  })
}
