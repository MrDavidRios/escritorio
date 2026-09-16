import { ImageIcon } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * File picker + preview for a card's image. Ties the form's `File | null`
 * value together with whatever image is already on the card (its signed
 * URL, when editing) so the preview is always right: the newly selected
 * file while one is pending, otherwise the existing image, otherwise a
 * placeholder.
 */
export function ImageUploadField({
  value,
  onChange,
  existingImageUrl,
  error,
}: {
  value: File | null
  onChange: (file: File | null) => void
  existingImageUrl?: string
  error?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const displayUrl = previewUrl ?? existingImageUrl

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Image</Label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-input bg-muted/50',
            error && 'border-destructive',
          )}
        >
          {displayUrl ? (
            <img src={displayUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-6 text-muted-foreground" />
          )}
        </button>
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            {displayUrl ? 'Change image' : 'Choose image'}
          </Button>
          {value && (
            <button
              type="button"
              className="text-left text-xs text-muted-foreground underline underline-offset-2"
              onClick={() => onChange(null)}
            >
              Cancel change
            </button>
          )}
          <p className="text-xs text-muted-foreground">or paste from clipboard</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
