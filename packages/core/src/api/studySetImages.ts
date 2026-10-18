import type { SupabaseClient } from '@supabase/supabase-js'
import { extensionOf, IMAGE_BUCKET } from './storage'

export function studySetImagePath(ownerId: string, studySetId: string, filename: string): string {
  return `${ownerId}/sets/${studySetId}.${extensionOf(filename)}`
}

export function createStudySetImagesApi(supabase: SupabaseClient) {
  // See uploadCardImage for why Blob and ArrayBuffer are handled differently.
  async function uploadStudySetImage(
    path: string,
    body: Blob | ArrayBuffer,
    { contentType, upsert = false }: { contentType: string; upsert?: boolean },
  ): Promise<void> {
    const { error } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(path, body, { contentType, upsert })
    if (error) throw error
  }

  async function deleteStudySetImages(paths: string[]): Promise<void> {
    if (paths.length === 0) return
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths)
    if (error) throw error
  }

  return { uploadStudySetImage, deleteStudySetImages }
}
