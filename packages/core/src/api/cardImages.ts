import type { SupabaseClient } from '@supabase/supabase-js'
import { createSignedUrlBatcher } from './signedUrlBatcher'
import { extensionOf, IMAGE_BUCKET } from './storage'

// Signed URLs are valid for an hour; React Query's staleTime is set below
// that (see useSignedImageUrls) so a fresh URL is fetched before the old
// one expires during a long session.
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60

export const SIGNED_URL_STALE_TIME_MS = (SIGNED_URL_EXPIRES_IN_SECONDS - 10 * 60) * 1000

export function cardImagePath(ownerId: string, cardId: string, filename: string): string {
  return `${ownerId}/${cardId}.${extensionOf(filename)}`
}

export function createCardImagesApi(supabase: SupabaseClient) {
  async function uploadCardImage(
    path: string,
    file: Blob,
    { upsert = false }: { upsert?: boolean } = {},
  ): Promise<void> {
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { upsert })
    if (error) throw error
  }

  async function deleteCardImages(paths: string[]): Promise<void> {
    if (paths.length === 0) return
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths)
    if (error) throw error
  }

  async function getSignedImageUrls(paths: string[]): Promise<Record<string, string>> {
    if (paths.length === 0) return {}
    const { data, error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_EXPIRES_IN_SECONDS)
    if (error) throw error

    const map: Record<string, string> = {}
    data.forEach((entry, i) => {
      if (entry.signedUrl) map[paths[i]] = entry.signedUrl
    })
    return map
  }

  return {
    uploadCardImage,
    deleteCardImages,
    getSignedImageUrls,
    // One signed URL per path, batched with any others requested in the same
    // tick (see useSignedImageUrls). Null when the object has no signed URL.
    // One batcher per client, so batching works as long as each app calls
    // createApi once.
    getSignedImageUrl: createSignedUrlBatcher(getSignedImageUrls),
  }
}
