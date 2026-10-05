const MAX_DIMENSION = 1600
const WEBP_QUALITY = 0.82

// Formats a canvas round-trip would flatten (animation) or rasterize (vector).
const PASS_THROUGH_TYPES = new Set(['image/gif', 'image/svg+xml'])

/** Scales (width, height) down to fit within `max` on the longest side; never upscales. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

export function shouldOptimize(file: File): boolean {
  return file.type.startsWith('image/') && !PASS_THROUGH_TYPES.has(file.type)
}

/** Whether the re-encoded result is worth uploading instead of the original. */
export function isSmallerWebp(original: File, encoded: Blob | null): encoded is Blob {
  return !!encoded && encoded.type === 'image/webp' && encoded.size < original.size
}

function renameToWebp(filename: string): string {
  return `${filename.replace(/\.[^.]*$/, '')}.webp`
}

/**
 * Downscales and re-encodes an image as WebP before upload, so a multi-MB
 * phone photo isn't served in full to every <img>. Falls back to the
 * original file whenever optimizing isn't possible or doesn't help (GIF/SVG,
 * undecodable input, a browser that can't encode WebP, or a result that
 * isn't smaller), so callers can always upload whatever this returns.
 */
export async function optimizeImage(file: File): Promise<File> {
  if (!shouldOptimize(file)) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_DIMENSION)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)

    // Browsers without WebP encoding silently hand back a PNG here.
    const encoded = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY),
    )
    if (!isSmallerWebp(file, encoded)) return file

    return new File([encoded], renameToWebp(file.name), { type: 'image/webp' })
  } finally {
    bitmap.close()
  }
}
