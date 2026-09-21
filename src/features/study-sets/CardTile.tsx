import { BadgeQuestionMark, BookOpen, ImageIcon, Languages, X } from 'lucide-react'
import { useRef } from 'react'
import { AccentedCharPad } from '@/components/AccentedCharPad'
import { InlineText } from '@/components/InlineText'
import { Button } from '@/components/ui/button'

export type CardTileProps = {
  imageUrl?: string
  onPickImage: (file: File) => void
  onRemoveImage?: () => void
  canRemoveImage?: boolean
  spanishTerm: string
  onSaveSpanishTerm: (value: string) => void
  autoFocusSpanishTerm?: boolean
  englishEquivalent: string
  onSaveEnglishEquivalent: (value: string) => void
  definition: string
  onSaveDefinition: (value: string) => void
  hint: string
  onSaveHint: (value: string) => void
  cornerSlot?: React.ReactNode
  footer?: React.ReactNode
}

export function CardTile({
  imageUrl,
  onPickImage,
  onRemoveImage,
  canRemoveImage = false,
  spanishTerm,
  onSaveSpanishTerm,
  autoFocusSpanishTerm = false,
  englishEquivalent,
  onSaveEnglishEquivalent,
  definition,
  onSaveDefinition,
  hint,
  onSaveHint,
  cornerSlot,
  footer,
}: CardTileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="ring-foreground/10 group relative flex flex-col rounded-xl ring-1">
      <div className="group/image bg-muted/50 relative aspect-[4/3] w-full overflow-hidden rounded-t-xl">
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white opacity-0 transition-opacity duration-150 group-focus-within/image:opacity-100 group-hover/image:opacity-100 [@media(hover:none)]:bg-black/30 [@media(hover:none)]:opacity-100"
            >
              Change
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-full flex-col items-center justify-center gap-1 transition-colors duration-150"
          >
            <ImageIcon className="size-6" />
            <span className="text-xs">Add image</span>
          </button>
        )}
        {canRemoveImage && onRemoveImage && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove image"
            onClick={(e) => {
              e.stopPropagation()
              onRemoveImage()
            }}
            className="absolute top-2 left-2 bg-black/40 text-white opacity-0 transition-opacity duration-150 hover:bg-black/60 hover:text-white group-focus-within/image:opacity-100 group-hover/image:opacity-100 [@media(hover:none)]:opacity-70"
          >
            <X />
          </Button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onPickImage(file)
          }}
        />
      </div>

      {cornerSlot}

      <div className="flex flex-col gap-0.5 p-3">
        <InlineText
          value={spanishTerm}
          onSave={onSaveSpanishTerm}
          placeholder="Spanish term"
          label="Card spanish term"
          required
          autoFocus={autoFocusSpanishTerm}
          className="font-medium"
          accessory={(insert) => <AccentedCharPad onInsert={insert} />}
        />
        <InlineText
          value={englishEquivalent}
          onSave={onSaveEnglishEquivalent}
          placeholder="Add an English equivalent"
          label="Card English equivalent"
          className="text-muted-foreground text-sm"
          icon={<Languages />}
        />
        <InlineText
          value={definition}
          onSave={onSaveDefinition}
          placeholder="Add a definition"
          label="Card definition"
          multiline
          className="text-muted-foreground text-sm"
          icon={<BookOpen />}
        />
        <InlineText
          value={hint}
          onSave={onSaveHint}
          placeholder="Add a hint"
          label="Card hint"
          className="text-muted-foreground text-sm"
          icon={<BadgeQuestionMark />}
        />
      </div>

      {footer}
    </div>
  )
}
