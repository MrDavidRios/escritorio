import type { SupabaseClient } from '@supabase/supabase-js'
import { createSignedUrlBatcher } from './signedUrlBatcher'
import { extensionOf, IMAGE_BUCKET } from './storage'

// Signed URLs are valid for an hour; React Query's staleTime is set below
// that (see useSignedImageUrls) so a fresh URL is fetched before the old
// one expires during a long session.
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60

export const SIGNED_URL_STALE_TIME_MS = (SIGNED_URL_EXPIRES_IN_SECONDS - 10 * 60) * 1000

const LIST_PAGE_SIZE = 100

export function cardImagePath(ownerId: string, cardId: string, filename: string): string {
  return `${ownerId}/${cardId}.${extensionOf(filename)}`
}

export function createCardImagesApi(supabase: SupabaseClient) {
  // Blob (web File) uploads as multipart and keeps the blob's own type;
  // ArrayBuffer (React Native, which can't upload Blobs) is sent raw with
  // contentType, so images are served with the right MIME type either way.
  async function uploadCardImage(
    path: string,
    body: Blob | ArrayBuffer,
    { contentType, upsert = false }: { contentType: string; upsert?: boolean },
  ): Promise<void> {
    const { error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, body, { contentType, upsert })
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

  /**
   * Storage path → updated_at for every image the user has stored: card
   * images (`owner/<card>.ext`) and set images (`owner/sets/<set>.ext`).
   * Images are overwritten in place, so updated_at is how the offline
   * mirror notices a replaced image.
   */
  async function listImageVersions(ownerId: string): Promise<Record<string, string>> {
    const versions: Record<string, string> = {}
    for (const folder of [ownerId, `${ownerId}/sets`]) {
      for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
        const { data, error } = await supabase.storage.from(IMAGE_BUCKET).list(folder, {
          limit: LIST_PAGE_SIZE,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        })
        if (error) throw error
        for (const object of data) {
          // Sub-folders (like `sets`) are listed with a null id.
          if (object.id && object.updated_at)
            versions[`${folder}/${object.name}`] = object.updated_at
        }
        if (data.length < LIST_PAGE_SIZE) break
      }
    }
    return versions
  }

  return {
    uploadCardImage,
    listImageVersions,
    deleteCardImages,
    getSignedImageUrls,
    // One signed URL per path, batched with any others requested in the same
    // tick (see useSignedImageUrls). Null when the object has no signed URL.
    // One batcher per client, so batching works as long as each app calls
    // createApi once.
    getSignedImageUrl: createSignedUrlBatcher(getSignedImageUrls),
  }
}
