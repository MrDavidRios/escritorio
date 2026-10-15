import { isAcceptedImage } from './imageFormats'

export async function extractDroppedImageFile(e: React.DragEvent): Promise<File | undefined> {
  const files = Array.from(e.dataTransfer.files)
  const file = files.find(isAcceptedImage)
  if (file) return file
  // Real files were dropped but none is usable (HEIC, PDF, ...).
  if (files.length > 0) return undefined

  // Dragging an <img> from a webpage (rather than a real OS file) gives us a
  // URL instead of a File — fetch it and convert it ourselves. This fails
  // silently for cross-origin images without CORS headers.
  const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
  if (!url) return undefined
  try {
    const blob = await fetch(url).then((res) => res.blob())
    const name = url.split('/').pop()?.split('?')[0] || 'image'
    const file = new File([blob], name, { type: blob.type })
    return isAcceptedImage(file) ? file : undefined
  } catch {
    return undefined
  }
}

export function extractPastedImageFile(e: React.ClipboardEvent): File | undefined {
  const item = Array.from(e.clipboardData.items).find(isAcceptedImage)
  return item?.getAsFile() ?? undefined
}
