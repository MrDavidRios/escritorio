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
  spanish_term: string
  english_equivalent: string
  definition: string
}

export function useCreateCard(studySetId: string, ownerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      image,
      hint,
      spanish_term,
      english_equivalent,
      definition,
    }: CardFormInput) => {
      if (!image && !definition.trim()) {
        throw new Error('An image or a definition is required')
      }

      // Existing cards determine the new card's position (appended to the
      // end); read from the cache rather than refetching.
      const existing = queryClient.getQueryData<Card[]>(cardsKey(studySetId)) ?? []

      const id = crypto.randomUUID()
      const imagePath = image ? cardImagePath(ownerId, id, image.name) : null

      // Upload first, then insert the DB row -- avoids a row ever
      // referencing a missing storage object.
      if (image && imagePath) await uploadCardImage(imagePath, image)
      try {
        return await createCard(id, studySetId, {
          image_path: imagePath,
          spanish_term,
          english_equivalent: english_equivalent || null,
          definition: definition || null,
          hint: hint || null,
          position: existing.length,
        })
      } catch (err) {
        if (imagePath) await deleteCardImages([imagePath]).catch(() => {})
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
      spanish_term,
      english_equivalent,
      definition,
      removeImage,
    }: {
      card: Card
      image: File | null
      hint: string
      spanish_term: string
      english_equivalent: string
      definition: string
      removeImage?: boolean
    }) => {
      let imagePath = card.image_path

      if (image) {
        const newPath = cardImagePath(ownerId, card.id, image.name)
        if (newPath === card.image_path) {
          // Same extension: overwrite in place.
          await uploadCardImage(newPath, image, { upsert: true })
        } else {
          await uploadCardImage(newPath, image)
          if (card.image_path) await deleteCardImages([card.image_path]).catch(() => {})
          imagePath = newPath
        }
      } else if (removeImage && card.image_path) {
        await deleteCardImages([card.image_path]).catch(() => {})
        imagePath = null
      }

      return updateCard(card.id, {
        image_path: imagePath,
        hint: hint || null,
        spanish_term,
        english_equivalent: english_equivalent || null,
        definition: definition || null,
      })
    },
    onMutate: async ({ card, hint, spanish_term, english_equivalent, definition, removeImage }) => {
      await queryClient.cancelQueries({ queryKey: cardsKey(studySetId) })
      const previous = queryClient.getQueryData<Card[]>(cardsKey(studySetId))
      queryClient.setQueryData<Card[]>(cardsKey(studySetId), (cards) =>
        cards?.map((c) =>
          c.id === card.id
            ? {
                ...c,
                hint: hint || null,
                spanish_term,
                english_equivalent: english_equivalent || null,
                definition: definition || null,
                image_path: removeImage ? null : c.image_path,
              }
            : c,
        ),
      )
      return previous
    },
    onError: (_err, _variables, context) => {
      queryClient.setQueryData(cardsKey(studySetId), context)
    },
    onSettled: () => {
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
      if (card.image_path) await deleteCardImages([card.image_path])
      await deleteCard(card.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cardsKey(studySetId) })
    },
  })
}
