import {
  BadgeQuestionMark,
  BookOpen,
  Download,
  ImageIcon,
  Languages,
  type LucideIcon,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { AccentedCharPad } from '@/components/AccentedCharPad'
import { InlineText } from '@/components/InlineText'
import { Button } from '@/components/ui/button'
import { DefinitionLookupButton } from './DefinitionLookupButton'
import { extractDroppedImageFile, extractPastedImageFile } from './imageDrop'

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
  /**
   * Render only filled optional fields; empty ones collapse into a single
   * "+ English  + Hint" line at the tile's bottom, shown on hover/focus.
   */
  collapseEmptyFields?: boolean
}

type OptionalField = 'english' | 'definition' | 'hint'

const OPTIONAL_FIELD_LABELS: Record<
  OptionalField,
  { short: string; long: string; Icon: LucideIcon }
> = {
  english: { short: 'English equivalent', long: 'Add an English equivalent', Icon: Languages },
  definition: { short: 'Definition', long: 'Add a definition', Icon: BookOpen },
  hint: { short: 'Hint', long: 'Add a hint', Icon: BadgeQuestionMark },
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
  collapseEmptyFields = false,
}: CardTileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  // The empty field the user just opened from the "+" line, rendered in
  // place until it either gains a value or is closed empty.
  const [openField, setOpenField] = useState<OptionalField | null>(null)
  const refocusAddButton = useRef<OptionalField | null>(null)

  const values: Record<OptionalField, string> = { english: englishEquivalent, definition, hint }
  if (openField && values[openField].trim()) {
    setOpenField(null)
  }

  // With collapsed fields, an empty image is just another "+ Image" chip
  // instead of a full-size placeholder repeated on every text-only tile.
  const showImageZone = !collapseEmptyFields || Boolean(imageUrl)

  const isShown = (field: OptionalField) =>
    !collapseEmptyFields || Boolean(values[field].trim()) || openField === field
  const missingFields = (['english', 'definition', 'hint'] as const).filter(
    (field) => !isShown(field),
  )

  function closeField(field: OptionalField, result: string) {
    if (result.trim()) return
    refocusAddButton.current = field
    setOpenField(null)
  }

  return (
    <div
      className={`group relative flex flex-col rounded-xl ring-1 transition-shadow duration-150 ${
        isDraggingOver ? 'ring-primary ring-2' : 'ring-foreground/10'
      }`}
      onPaste={(e) => {
        const file = extractPastedImageFile(e)
        if (file) onPickImage(file)
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        setIsDraggingOver(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setIsDraggingOver(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setIsDraggingOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setIsDraggingOver(false)
        extractDroppedImageFile(e).then((file) => {
          if (file) onPickImage(file)
        })
      }}
    >
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

      {showImageZone && (
        <div className="group/image bg-muted/50 relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-t-xl">
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
              {isDraggingOver ? (
                <Download className="pointer-events-none size-6" />
              ) : (
                <ImageIcon className="pointer-events-none size-6" />
              )}
              <span className="pointer-events-none text-xs">
                {isDraggingOver ? 'Drop to add image' : 'Add image'}
              </span>
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
              className="absolute top-2 left-2 bg-black/40 text-white opacity-0 transition-opacity duration-150 group-focus-within/image:opacity-100 group-hover/image:opacity-100 hover:bg-black/60 hover:text-white [@media(hover:none)]:opacity-70"
            >
              <X />
            </Button>
          )}
        </div>
      )}

      {!showImageZone && isDraggingOver && (
        <div className="bg-background/85 text-muted-foreground pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-xl text-sm">
          <Download className="size-6" />
          Drop to add image
        </div>
      )}

      {cornerSlot}

      <div className="flex flex-1 flex-col gap-0.5 p-3">
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
        {isShown('english') && (
          <InlineText
            value={englishEquivalent}
            onSave={onSaveEnglishEquivalent}
            placeholder={OPTIONAL_FIELD_LABELS.english.long}
            label="Card English equivalent"
            className="text-muted-foreground text-sm"
            icon={<Languages />}
            autoFocus={openField === 'english'}
            onEditingEnd={(result) => closeField('english', result)}
          />
        )}
        {isShown('definition') && (
          <InlineText
            value={definition}
            onSave={onSaveDefinition}
            placeholder={OPTIONAL_FIELD_LABELS.definition.long}
            label="Card definition"
            multiline
            className="text-muted-foreground text-sm"
            icon={<BookOpen />}
            autoFocus={openField === 'definition'}
            onEditingEnd={(result) => closeField('definition', result)}
            trailingAction={({ draft, setDraft, preventNextBlurCommit, commitAndExit }) => (
              <DefinitionLookupButton
                spanishTerm={spanishTerm}
                draft={draft}
                onResult={setDraft}
                preventNextBlurCommit={preventNextBlurCommit}
                commitAndExit={commitAndExit}
              />
            )}
          />
        )}
        {isShown('hint') && (
          <InlineText
            value={hint}
            onSave={onSaveHint}
            placeholder={OPTIONAL_FIELD_LABELS.hint.long}
            label="Card hint"
            className="text-muted-foreground text-sm"
            icon={<BadgeQuestionMark />}
            autoFocus={openField === 'hint'}
            onEditingEnd={(result) => closeField('hint', result)}
          />
        )}

        {(missingFields.length > 0 || !showImageZone) && (
          <div className="mt-auto flex flex-wrap gap-x-1 pt-2 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            {!showImageZone && (
              <button
                type="button"
                aria-label="Add an image"
                onClick={() => fileInputRef.current?.click()}
                className="text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:bg-muted/60 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors duration-150 first:-ml-1.5"
              >
                <ImageIcon className="size-3" />
                Image
              </button>
            )}
            {missingFields.map((field) => {
              const { short, long, Icon } = OPTIONAL_FIELD_LABELS[field]
              return (
                <button
                  key={field}
                  ref={(el) => {
                    // Closing an opened field empty unmounts its input; hand
                    // focus back to this button unless it already moved on.
                    if (
                      el &&
                      refocusAddButton.current === field &&
                      (!document.activeElement || document.activeElement === document.body)
                    ) {
                      el.focus()
                    }
                    if (el && refocusAddButton.current === field) refocusAddButton.current = null
                  }}
                  type="button"
                  aria-label={long}
                  onClick={() => setOpenField(field)}
                  className="text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:bg-muted/60 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors duration-150 first:-ml-1.5"
                >
                  <Icon className="size-3" />
                  {short}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {footer}
    </div>
  )
}
