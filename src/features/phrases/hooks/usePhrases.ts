import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteCardImages, phraseImagePath, uploadCardImage } from '@/api/cardImages'
import {
  addIdiomAsPhrase,
  createPhrase,
  deletePhrase,
  listPhrases,
  updatePhrase,
} from '@/api/phrases'
import { optimizeImage } from '@/features/study-sets/optimizeImage'
import type { Phrase } from '@/types/phrase'

export function phrasesKey() {
  return ['phrases'] as const
}

export function usePhrases({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: phrasesKey(), queryFn: listPhrases, enabled })
}

export interface PhraseFormInput {
  spanish: string
  english: string
  example: string
  image: File | null
  removeImage: boolean
}

export function useCreatePhrase(ownerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ spanish, english, example, image: rawImage }: PhraseFormInput) => {
      const image = rawImage ? await optimizeImage(rawImage) : null
      const id = crypto.randomUUID()
      const imagePath = image ? phraseImagePath(ownerId, id, image.name) : null

      // Upload first, then insert -- a row never references a missing object.
      if (image && imagePath) await uploadCardImage(imagePath, image)
      try {
        return await createPhrase(id, {
          spanish: spanish.trim(),
          english: english.trim(),
          example: example.trim() || null,
          image_path: imagePath,
          idiom_id: null,
        })
      } catch (err) {
        if (imagePath) await deleteCardImages([imagePath]).catch(() => {})
        throw err
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: phrasesKey() }),
  })
}

export function useUpdatePhrase(ownerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      phrase,
      spanish,
      english,
      example,
      image: rawImage,
      removeImage,
    }: PhraseFormInput & { phrase: Phrase }) => {
      let imagePath = phrase.image_path

      if (rawImage) {
        const image = await optimizeImage(rawImage)
        const newPath = phraseImagePath(ownerId, phrase.id, image.name)
        if (newPath === phrase.image_path) {
          await uploadCardImage(newPath, image, { upsert: true })
        } else {
          await uploadCardImage(newPath, image)
          if (phrase.image_path) await deleteCardImages([phrase.image_path]).catch(() => {})
          imagePath = newPath
        }
      } else if (removeImage && phrase.image_path) {
        await deleteCardImages([phrase.image_path]).catch(() => {})
        imagePath = null
      }

      return updatePhrase(phrase.id, {
        spanish: spanish.trim(),
        english: english.trim(),
        example: example.trim() || null,
        image_path: imagePath,
      })
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: phrasesKey() }),
  })
}

export function useDeletePhrase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (phrase: Phrase) => {
      // Same order as cards: an orphaned row is safer than an orphaned blob.
      if (phrase.image_path) await deleteCardImages([phrase.image_path])
      await deletePhrase(phrase.id)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: phrasesKey() }),
  })
}

export function useAddIdiomToPhrases() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: addIdiomAsPhrase,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: phrasesKey() }),
  })
}
