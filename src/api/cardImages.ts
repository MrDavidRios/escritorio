import { supabase } from '@/lib/supabase'

const BUCKET = 'flashcard-images'

// Signed URLs are valid for an hour; React Query's staleTime is set below
// that (see useSignedImageUrls) so a fresh URL is fetched before the old
// one expires during a long session.
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60

function extensionOf(filename: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename)
  return match ? match[1].toLowerCase() : 'bin'
}

export function cardImagePath(ownerId: string, cardId: string, filename: string): string {
  return `${ownerId}/${cardId}.${extensionOf(filename)}`
}

export async function uploadCardImage(
  path: string,
  file: File,
  { upsert = false }: { upsert?: boolean } = {},
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert })
  if (error) throw error
}

export async function deleteCardImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
}

export async function getSignedImageUrls(
  paths: string[],
): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_EXPIRES_IN_SECONDS)
  if (error) throw error

  const map: Record<string, string> = {}
  data.forEach((entry, i) => {
    if (entry.signedUrl) map[paths[i]] = entry.signedUrl
  })
  return map
}

export const SIGNED_URL_STALE_TIME_MS = (SIGNED_URL_EXPIRES_IN_SECONDS - 10 * 60) * 1000
