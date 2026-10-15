// Passed to <input accept>. Leaving HEIC/HEIF out of this list (rather than
// using image/*) also makes iOS convert camera photos to JPEG on pick.
export const IMAGE_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml,image/bmp'

const HEIC_TYPE = /^image\/hei[cf](-sequence)?$/i
const HEIC_EXTENSION = /\.hei[cf]s?$/i

/**
 * HEIC/HEIF can't be decoded by most browsers, so an uploaded one would be
 * stored but never display. Some platforms report an empty MIME type for
 * them, so fall back to the extension when a name is available.
 */
export function isHeic({ type, name }: { type: string; name?: string }): boolean {
  return HEIC_TYPE.test(type) || (type === '' && !!name && HEIC_EXTENSION.test(name))
}

/** Any image the app will take: image/* minus HEIC/HEIF. */
export function isAcceptedImage(file: { type: string; name?: string }): boolean {
  return file.type.startsWith('image/') && !isHeic(file)
}
