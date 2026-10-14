import { ImagePlus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { IMAGE_ACCEPT } from '@/features/study-sets/imageFormats'
import { extractDroppedImageFile } from '@/features/study-sets/imageDrop'
import { cn } from '@/lib/utils'

/** Optional image: click to pick, drop a file/web image, or paste (handled by the form). */
export function PhraseImageField({
  previewUrl,
  onPick,
  onRemove,
}: {
  previewUrl: string | null
  onPick: (file: File) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={async (e) => {
        e.preventDefault()
        setDragging(false)
        const file = await extractDroppedImageFile(e)
        if (file) onPick(file)
      }}
      className={cn(
        'bg-muted/30 relative flex min-h-32 items-center justify-center overflow-hidden rounded-lg border border-dashed',
        dragging && 'border-primary bg-primary/5',
      )}
    >
      {previewUrl ? (
        <>
          <img src={previewUrl} alt="" className="max-h-48 w-full object-contain" />
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            aria-label="Remove image"
            className="absolute top-2 right-2"
            onClick={onRemove}
          >
            <X />
          </Button>
        </>
      ) : (
        <Button type="button" variant="ghost" onClick={() => inputRef.current?.click()}>
          <ImagePlus data-icon="inline-start" />
          Add an image (optional)
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPick(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
