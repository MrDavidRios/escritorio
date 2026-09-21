export async function extractDroppedImageFile(e: React.DragEvent): Promise<File | undefined> {
  const files = Array.from(e.dataTransfer.files)
  const file = files.find((f) => f.type.startsWith('image/')) ?? files[0]
  if (file) return file

  // Dragging an <img> from a webpage (rather than a real OS file) gives us a
  // URL instead of a File — fetch it and convert it ourselves. This fails
  // silently for cross-origin images without CORS headers.
  const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
  if (!url) return undefined
  try {
    const blob = await fetch(url).then((res) => res.blob())
    if (!blob.type.startsWith('image/')) return undefined
    const name = url.split('/').pop()?.split('?')[0] || 'image'
    return new File([blob], name, { type: blob.type })
  } catch {
    return undefined
  }
}

export function extractPastedImageFile(e: React.ClipboardEvent): File | undefined {
  const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
  return item?.getAsFile() ?? undefined
}
