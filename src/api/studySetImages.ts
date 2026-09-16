import { supabase } from '@/lib/supabase'

// Shares the flashcard-images bucket (and its owner-scoped RLS policies)
// with card images -- see src/api/cardImages.ts. Nested under `sets/` so a
// study set's image path can never collide with a card's.
const BUCKET = 'flashcard-images'

function extensionOf(filename: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename)
  return match ? match[1].toLowerCase() : 'bin'
}

export function studySetImagePath(
  ownerId: string,
  studySetId: string,
  filename: string,
): string {
  return `${ownerId}/sets/${studySetId}.${extensionOf(filename)}`
}

export async function uploadStudySetImage(
  path: string,
  file: File,
  { upsert = false }: { upsert?: boolean } = {},
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert })
  if (error) throw error
}

export async function deleteStudySetImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
}
