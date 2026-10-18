import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/features/auth/AuthContext'
import { queryKeys, studySetImagePath, type StudySet, type StudySetInput } from '@escritorio/core'
import { optimizeImage } from '../optimizeImage'

export function useStudySets() {
  return useQuery({
    queryKey: queryKeys.studySets(),
    queryFn: api.studySets.listStudySets,
  })
}

export function useStudySet(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.studySet(id ?? ''),
    queryFn: () => api.studySets.getStudySet(id!),
    enabled: !!id,
  })
}

export function useCreateStudySet() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (input: StudySetInput) => api.studySets.createStudySet(user!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studySets() })
    },
  })
}

export interface StudySetFormInput {
  title: string
  description: string | null
  image: File | null
  currentImagePath: string | null
  removeImage?: boolean
}

export function useUpdateStudySet(id: string) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      title,
      description,
      image: rawImage,
      currentImagePath,
      removeImage,
    }: StudySetFormInput) => {
      let imagePath = currentImagePath

      if (rawImage) {
        const image = await optimizeImage(rawImage)
        const newPath = studySetImagePath(user!.id, id, image.name)
        if (newPath === currentImagePath) {
          // Same extension: overwrite in place.
          await api.studySetImages.uploadStudySetImage(newPath, image, { upsert: true })
        } else {
          await api.studySetImages.uploadStudySetImage(newPath, image)
          if (currentImagePath) {
            await api.studySetImages.deleteStudySetImages([currentImagePath]).catch(() => {})
          }
          imagePath = newPath
        }
      } else if (removeImage && currentImagePath) {
        await api.studySetImages.deleteStudySetImages([currentImagePath]).catch(() => {})
        imagePath = null
      }

      return api.studySets.updateStudySet(id, { title, description, image_path: imagePath })
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studySets() })
      queryClient.setQueryData(queryKeys.studySet(id), data)
    },
  })
}

export function usePatchStudySet(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (patch: Partial<StudySetInput>) => api.studySets.updateStudySet(id, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.studySet(id) })
      const previous = queryClient.getQueryData<StudySet>(queryKeys.studySet(id))
      queryClient.setQueryData<StudySet>(
        queryKeys.studySet(id),
        (prev) => prev && { ...prev, ...patch },
      )
      return previous
    },
    onError: (_err, _patch, context) => {
      queryClient.setQueryData(queryKeys.studySet(id), context)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studySet(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.studySets() })
    },
  })
}

export function useDeleteStudySet() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      // The DB cascade removes card rows, but not their storage objects --
      // clean those up first, or a deleted set leaves orphaned images.
      const studySet = await api.studySets.getStudySet(id)
      const cards = await api.cards.listCards(id)
      const imagePaths = cards.map((card) => card.image_path).filter((p): p is string => p != null)
      if (imagePaths.length > 0) await api.cardImages.deleteCardImages(imagePaths)
      if (studySet.image_path) {
        await api.studySetImages.deleteStudySetImages([studySet.image_path])
      }
      await api.studySets.deleteStudySet(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.studySets() })
    },
  })
}
