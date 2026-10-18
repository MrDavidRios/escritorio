import type { SupabaseClient } from '@supabase/supabase-js'
import { extensionOf, IMAGE_BUCKET } from './storage'

export function studySetImagePath(ownerId: string, studySetId: string, filename: string): string {
  return `${ownerId}/sets/${studySetId}.${extensionOf(filename)}`
}

export function createStudySetImagesApi(supabase: SupabaseClient) {
  async function uploadStudySetImage(
    path: string,
    file: Blob,
    { upsert = false }: { upsert?: boolean } = {},
  ): Promise<void> {
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { upsert })
    if (error) throw error
  }

  async function deleteStudySetImages(paths: string[]): Promise<void> {
    if (paths.length === 0) return
    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths)
    if (error) throw error
  }

  return { uploadStudySetImage, deleteStudySetImages }
}
