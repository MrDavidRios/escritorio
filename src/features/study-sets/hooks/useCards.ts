import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cardImagePath, deleteCardImages, uploadCardImage } from '@/api/cardImages'
import { createCard, deleteCard, listCards, updateCard } from '@/api/cards'
import type { Card } from '@/types/card'

export function cardsKey(studySetId: string) {
  return ['cards', studySetId] as const
}

export function useCards(studySetId: string | undefined) {
  return useQuery({
    queryKey: cardsKey(studySetId ?? ''),
    queryFn: () => listCards(studySetId!),
    enabled: !!studySetId,
  })
}

export interface CardFormInput {
  image: File | null
  hint: string
  answer: string
}

export function useCreateCard(studySetId: string, ownerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ image, hint, answer }: CardFormInput) => {
      if (!image) throw new Error('An image is required')

      // Existing cards determine the new card's position (appended to the
      // end); read from the cache rather than refetching.
      const existing = queryClient.getQueryData<Card[]>(cardsKey(studySetId)) ?? []

      const id = crypto.randomUUID()
      const imagePath = cardImagePath(ownerId, id, image.name)

      // Upload first, then insert the DB row -- avoids a row ever
      // referencing a missing storage object.
      await uploadCardImage(imagePath, image)
      try {
        return await createCard(id, studySetId, {
          image_path: imagePath,
          hint: hint || null,
          answer,
          position: existing.length,
        })
      } catch (err) {
        await deleteCardImages([imagePath]).catch(() => {})
        throw err
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cardsKey(studySetId) })
    },
  })
}

export function useUpdateCard(studySetId: string, ownerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      card,
      image,
      hint,
      answer,
    }: {
      card: Card
      image: File | null
      hint: string
      answer: string
    }) => {
      let imagePath = card.image_path

      if (image) {
        const newPath = cardImagePath(ownerId, card.id, image.name)
        if (newPath === card.image_path) {
          // Same extension: overwrite in place.
          await uploadCardImage(newPath, image, { upsert: true })
        } else {
          await uploadCardImage(newPath, image)
          await deleteCardImages([card.image_path]).catch(() => {})
          imagePath = newPath
        }
      }

      return updateCard(card.id, { image_path: imagePath, hint: hint || null, answer })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cardsKey(studySetId) })
    },
  })
}

export function useDeleteCard(studySetId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (card: Card) => {
      // Delete the storage object first; the DB row is the source of
      // truth for what's still referenced, so an orphaned row is safer
      // to end up with (visible, fixable) than an orphaned blob.
      await deleteCardImages([card.image_path])
      await deleteCard(card.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cardsKey(studySetId) })
    },
  })
}
