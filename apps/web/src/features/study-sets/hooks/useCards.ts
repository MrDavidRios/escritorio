import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  REQUIRED_CONTENT_MESSAGE,
  cardImagePath,
  hasRequiredContent,
  queryKeys,
  type Card,
} from '@escritorio/core'
import { optimizeImage } from '../optimizeImage'

export function useCards(studySetId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cards(studySetId ?? ''),
    queryFn: () => api.cards.listCards(studySetId!),
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
      image: rawImage,
      hint,
      spanish_term,
      english_equivalent,
      definition,
    }: CardFormInput) => {
      if (
        !hasRequiredContent({
          hasImage: Boolean(rawImage),
          definition,
          englishEquivalent: english_equivalent,
        })
      ) {
        throw new Error(REQUIRED_CONTENT_MESSAGE)
      }

      // Existing cards determine the new card's position (appended to the
      // end); read from the cache rather than refetching.
      const existing = queryClient.getQueryData<Card[]>(queryKeys.cards(studySetId)) ?? []

      const image = rawImage ? await optimizeImage(rawImage) : null
      const id = crypto.randomUUID()
      const imagePath = image ? cardImagePath(ownerId, id, image.name) : null

      // Upload first, then insert the DB row -- avoids a row ever
      // referencing a missing storage object.
      if (image && imagePath)
        await api.cardImages.uploadCardImage(imagePath, image, { contentType: image.type })
      try {
        return await api.cards.createCard(id, studySetId, {
          image_path: imagePath,
          spanish_term,
          english_equivalent: english_equivalent || null,
          definition: definition || null,
          hint: hint || null,
          position: existing.length,
        })
      } catch (err) {
        if (imagePath) await api.cardImages.deleteCardImages([imagePath]).catch(() => {})
        throw err
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards(studySetId) })
    },
  })
}

export function useUpdateCard(studySetId: string, ownerId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      card,
      image: rawImage,
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

      if (rawImage) {
        const image = await optimizeImage(rawImage)
        const newPath = cardImagePath(ownerId, card.id, image.name)
        if (newPath === card.image_path) {
          // Same extension: overwrite in place.
          await api.cardImages.uploadCardImage(newPath, image, {
            contentType: image.type,
            upsert: true,
          })
        } else {
          await api.cardImages.uploadCardImage(newPath, image, { contentType: image.type })
          if (card.image_path)
            await api.cardImages.deleteCardImages([card.image_path]).catch(() => {})
          imagePath = newPath
        }
      } else if (removeImage && card.image_path) {
        await api.cardImages.deleteCardImages([card.image_path]).catch(() => {})
        imagePath = null
      }

      return api.cards.updateCard(card.id, {
        image_path: imagePath,
        hint: hint || null,
        spanish_term,
        english_equivalent: english_equivalent || null,
        definition: definition || null,
      })
    },
    onMutate: async ({ card, hint, spanish_term, english_equivalent, definition, removeImage }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.cards(studySetId) })
      const previous = queryClient.getQueryData<Card[]>(queryKeys.cards(studySetId))
      queryClient.setQueryData<Card[]>(queryKeys.cards(studySetId), (cards) =>
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
      queryClient.setQueryData(queryKeys.cards(studySetId), context)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards(studySetId) })
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
      if (card.image_path) await api.cardImages.deleteCardImages([card.image_path])
      await api.cards.deleteCard(card.id)
    },
    // Drop the card from the cache only once the backend has confirmed the
    // delete, and keep the mutation pending until the list has refreshed.
    onSuccess: (_data, card) => {
      queryClient.setQueryData<Card[]>(queryKeys.cards(studySetId), (cards) =>
        cards?.filter((c) => c.id !== card.id),
      )
      return queryClient.invalidateQueries({ queryKey: queryKeys.cards(studySetId) })
    },
  })
}
