import {
  BadgeQuestionMark,
  BookOpen,
  Download,
  ImageIcon,
  ImagePlus,
  Languages,
  type LucideIcon,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'

import { AccentedCharPad } from '@/components/AccentedCharPad'
import { InlineText } from '@/components/InlineText'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { DefinitionLookupButton } from './DefinitionLookupButton'
import { extractDroppedImageFile, extractPastedImageFile } from './imageDrop'

export type CardTileProps = {
  imageUrl?: string
  onPickImage: (file: File) => void
  onRemoveImage?: () => void
  /** When set, the remove button is shown but disabled, with this as its tooltip. */
  removeImageDisabledReason?: string
  spanishTerm: string
  onSaveSpanishTerm: (value: string) => void
  autoFocusSpanishTerm?: boolean
  englishEquivalent: string
  onSaveEnglishEquivalent: (value: string) => void
  definition: string
  onSaveDefinition: (value: string) => void
  hint: string
  onSaveHint: (value: string) => void
  /** Extra buttons at the end of the hover toolbar (collapsed tiles only). */
  actions?: React.ReactNode
  footer?: React.ReactNode
  /**
   * Render only filled optional fields; empty ones (and a missing image)
   * become icon buttons in a vertical toolbar straddling the tile's right
   * edge near its bottom, shown on hover/focus, so the tile is only as tall
   * as its content.
   */
  collapseEmptyFields?: boolean
}

type OptionalField = 'english' | 'definition' | 'hint'

const OPTIONAL_FIELD_LABELS: Record<OptionalField, { long: string; Icon: LucideIcon }> = {
  english: { long: 'Add an English equivalent', Icon: Languages },
  definition: { long: 'Add a definition', Icon: BookOpen },
  hint: { long: 'Add a hint', Icon: BadgeQuestionMark },
}

export function CardTile({
  imageUrl,
  onPickImage,
  onRemoveImage,
  removeImageDisabledReason,
  spanishTerm,
  onSaveSpanishTerm,
  autoFocusSpanishTerm = false,
  englishEquivalent,
  onSaveEnglishEquivalent,
  definition,
  onSaveDefinition,
  hint,
  onSaveHint,
  actions,
  footer,
  collapseEmptyFields = false,
}: CardTileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  // The empty field the user just opened from the "+" line, rendered in
  // place until it either gains a value or is closed empty.
  const [openField, setOpenField] = useState<OptionalField | null>(null)
  const addButtons = useRef<Partial<Record<OptionalField, HTMLButtonElement | null>>>({})

  const values: Record<OptionalField, string> = { english: englishEquivalent, definition, hint }
  if (openField && values[openField].trim()) {
    setOpenField(null)
  }

  // With collapsed fields, an empty image is just another toolbar button
  // instead of a full-size placeholder repeated on every text-only tile.
  const showImageZone = !collapseEmptyFields || Boolean(imageUrl)

  const isShown = (field: OptionalField) =>
    !collapseEmptyFields || Boolean(values[field].trim()) || openField === field
  const missingFields = (['english', 'definition', 'hint'] as const).filter(
    (field) => !isShown(field),
  )

  function closeField(field: OptionalField, result: string) {
    if (result.trim()) return
    // Another field may already be opening (its toolbar button was clicked
    // while this one was still being edited); leave that one open.
    setOpenField((current) => (current === field ? null : current))
    // Closing an opened field empty unmounts its input. Once the browser has
    // settled focus, hand it back to this field's toolbar button, unless it
    // already landed somewhere, e.g. on whatever was clicked to close it.
    requestAnimationFrame(() => {
      if (document.activeElement && document.activeElement !== document.body) return
      addButtons.current[field]?.focus()
    })
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
        <div
          className={cn(
            'group/image bg-muted/50 relative w-full shrink-0 overflow-hidden rounded-t-xl',
            imageUrl ? '@container' : 'aspect-4/3',
          )}
        >
          {imageUrl ? (
            <>
              {/* Natural proportions, held between 16:9 and 3:4 so no one
                image dominates a column; the min-height also reserves space
                while the image loads. */}
              <img
                src={imageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="block h-auto max-h-[133cqw] min-h-[56.25cqw] w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 ease-out group-hover/image:bg-black/10 group-has-[:focus-visible]/image:bg-black/10" />
              <div className="pointer-events-none absolute top-2 right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="pointer-events-none flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-sm backdrop-blur-sm transition-[opacity,background-color] duration-200 ease-out group-hover/image:pointer-events-auto group-hover/image:opacity-100 group-has-[:focus-visible]/image:pointer-events-auto group-has-[:focus-visible]/image:opacity-100 hover:bg-black/70 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
                >
                  <ImagePlus className="size-3.5" />
                  Change
                </button>
                {onRemoveImage && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* aria-disabled rather than disabled: a natively disabled
                        button swallows pointer events, so the tooltip explaining
                        why it's disabled would never show. */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove image"
                        aria-disabled={removeImageDisabledReason ? true : undefined}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!removeImageDisabledReason) onRemoveImage()
                        }}
                        className={cn(
                          'pointer-events-none rounded-full bg-black/40 text-white opacity-0 transition-opacity duration-150 group-hover/image:pointer-events-auto group-hover/image:opacity-100 group-has-[:focus-visible]/image:pointer-events-auto group-has-[:focus-visible]/image:opacity-100 hover:bg-black/60 hover:text-white [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-70',
                          removeImageDisabledReason &&
                            'cursor-not-allowed group-hover/image:opacity-50 group-has-[:focus-visible]/image:opacity-50 hover:bg-black/40 [@media(hover:none)]:opacity-40',
                        )}
                      >
                        <X />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{removeImageDisabledReason ?? 'Remove image'}</TooltipContent>
                  </Tooltip>
                )}
              </div>
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
        </div>
      )}

      {!showImageZone && isDraggingOver && (
        <div className="bg-background/85 text-muted-foreground pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-xl text-sm">
          <Download className="size-6" />
          Drop to add image
        </div>
      )}

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
      </div>

      {collapseEmptyFields && (
        // Rail spanning the tile's height: the flex-1 spacer pushes the
        // toolbar to the bottom, and once the tile is shorter than the
        // toolbar the spacer collapses and justify-center centres it instead.
        <div className="pointer-events-none absolute top-3 right-0 bottom-3 z-10 flex flex-col justify-center">
          <div className="min-h-0 flex-1" />
          {/* Laid out but transparent until the tile is hovered or focused,
            so its buttons stay keyboard-reachable (focusing one reveals it)
            and can take focus back when an opened field closes empty. */}
          <div
            role="toolbar"
            aria-orientation="vertical"
            aria-label="Card actions"
            className="bg-background ring-foreground/10 pointer-events-none flex shrink-0 translate-x-1/2 flex-col items-center gap-0.5 rounded-lg p-0.5 opacity-0 shadow-sm ring-1 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
          >
            {!showImageZone && (
              <ToolbarButton label="Add an image" onClick={() => fileInputRef.current?.click()}>
                <ImageIcon />
              </ToolbarButton>
            )}
            {missingFields.map((field) => {
              const { long, Icon } = OPTIONAL_FIELD_LABELS[field]
              return (
                <ToolbarButton
                  key={field}
                  label={long}
                  onClick={() => setOpenField(field)}
                  buttonRef={(el) => {
                    addButtons.current[field] = el
                  }}
                >
                  <Icon />
                </ToolbarButton>
              )
            })}
            {actions && (missingFields.length > 0 || !showImageZone) && (
              <span aria-hidden className="bg-foreground/10 my-0.5 h-px w-4" />
            )}
            {actions}
          </div>
        </div>
      )}

      {footer}
    </div>
  )
}

function ToolbarButton({
  label,
  onClick,
  buttonRef,
  children,
}: {
  label: string
  onClick: () => void
  buttonRef?: React.Ref<HTMLButtonElement>
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={buttonRef}
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          // Keep focus where it is during the press: blurring an open field
          // here would close it and reshuffle the toolbar under the pointer
          // before mouseup, so the click would never land.
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className="text-muted-foreground hover:text-foreground"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
