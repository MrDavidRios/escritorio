// Card and study set images share one bucket (and its owner-scoped RLS
// policies). Study set images are nested under `sets/` so their paths can
// never collide with a card's.
export const IMAGE_BUCKET = 'flashcard-images'

export function extensionOf(filename: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename)
  return match ? match[1].toLowerCase() : 'bin'
}
