import { useEffect, useRef, useState } from 'react'
import { useCursorInsert } from '@/hooks/useCursorInsert'
import { useFloatingPosition } from '@/hooks/useFloatingPosition'
import { cn } from '@/lib/utils'

const BOX = '-mx-2 rounded-md px-2 py-0.5'

type InlineTextProps = {
  value: string
  onSave: (next: string) => void
  placeholder: string
  label: string
  multiline?: boolean
  required?: boolean
  as?: 'h1' | 'h2' | 'p' | 'span'
  className?: string
  /** Rendered above the field while editing, wired to insert at the caret. */
  accessory?: (insert: (text: string) => void) => React.ReactNode
  /** Rendered inline after the field while editing, with direct read/write access to the draft. */
  trailingAction?: (ctx: {
    draft: string
    setDraft: (next: string) => void
    /** Suppresses the next blur-triggered commit/exit, e.g. while a confirmation dialog steals focus. */
    preventNextBlurCommit: () => void
  }) => React.ReactNode
  /** Rendered before the value/placeholder. */
  icon?: React.ReactNode
  /** Start already in edit mode on mount. */
  autoFocus?: boolean
}

export function InlineText({
  value,
  onSave,
  placeholder,
  label,
  multiline = false,
  required = false,
  as = 'span',
  className,
  accessory,
  trailingAction,
  icon,
  autoFocus = false,
}: InlineTextProps) {
  const [editing, setEditing] = useState(autoFocus)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const focusButtonOnExit = useRef(false)
  const skipBlurCommit = useRef(false)
  const clickOffset = useRef<number | null>(null)
  const cursor = useCursorInsert(
    () => draft,
    (next) => setDraft(next),
  )
  const {
    referenceRef,
    floatingRef: accessoryRef,
    position: accessoryPosition,
  } = useFloatingPosition<HTMLInputElement | HTMLTextAreaElement, HTMLDivElement>(
    Boolean(accessory),
    [editing],
  )

  useEffect(() => {
    if (!editing) return
    const el = inputRef.current
    if (!el) return
    el.focus()
    const offset = clickOffset.current ?? el.value.length
    clickOffset.current = null
    el.setSelectionRange(offset, offset)
  }, [editing])

  useEffect(() => {
    if (!editing || !multiline) return
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft, editing, multiline])

  useEffect(() => {
    if (!editing && focusButtonOnExit.current) {
      buttonRef.current?.focus()
      focusButtonOnExit.current = false
    }
  }, [editing])

  function startEditing(offset: number | null = null) {
    clickOffset.current = offset
    setDraft(value)
    setEditing(true)
  }

  function getOffsetFromPoint(x: number, y: number): number | null {
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    }
    if (typeof doc.caretPositionFromPoint === 'function') {
      const pos = doc.caretPositionFromPoint(x, y)
      if (pos?.offsetNode.nodeType === Node.TEXT_NODE) return pos.offset
      return null
    }
    if (typeof document.caretRangeFromPoint === 'function') {
      const range = document.caretRangeFromPoint(x, y)
      if (range?.startContainer.nodeType === Node.TEXT_NODE) return range.startOffset
      return null
    }
    return null
  }

  function commit() {
    const trimmed = draft.trim()
    if ((required && trimmed === '') || trimmed === value.trim()) {
      focusButtonOnExit.current = true
      setEditing(false)
      return
    }
    onSave(trimmed)
    focusButtonOnExit.current = true
    setEditing(false)
  }

  function preventNextBlurCommit() {
    skipBlurCommit.current = true
  }

  function revert() {
    setDraft(value)
    focusButtonOnExit.current = true
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      skipBlurCommit.current = true
      revert()
      return
    }
    if (e.key === 'Enter') {
      if (multiline) {
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          commit()
        }
        return
      }
      e.preventDefault()
      commit()
    }
  }

  function handleBlur() {
    if (skipBlurCommit.current) {
      skipBlurCommit.current = false
      return
    }
    commit()
  }

  const Wrapper = as

  if (!editing) {
    return (
      <Wrapper className={cn(className, 'relative')}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={label}
          onClick={(e) =>
            startEditing(value && e.detail > 0 ? getOffsetFromPoint(e.clientX, e.clientY) : null)
          }
          className={cn(
            BOX,
            'hover:bg-muted/60 focus-visible:bg-muted/60 flex w-full max-w-full items-start gap-1.5 text-left transition-colors duration-150',
            !value && 'text-muted-foreground/50',
            multiline && 'whitespace-pre-wrap',
          )}
        >
          {icon && (
            <span className="text-muted-foreground mt-0.5 shrink-0 [&_svg]:size-3.5">{icon}</span>
          )}
          <span className={cn(multiline && 'whitespace-pre-wrap')}>{value || placeholder}</span>
        </button>
      </Wrapper>
    )
  }

  const inputClassName = cn(
    BOX,
    'placeholder:text-muted-foreground/50 block w-full max-w-full bg-transparent text-inherit outline-none [font:inherit] [letter-spacing:inherit]',
  )

  return (
    <Wrapper className={cn(className, 'relative')}>
      {accessory && (
        <div
          ref={accessoryRef}
          style={{
            position: 'absolute',
            top: accessoryPosition.y,
            left: accessoryPosition.x,
          }}
          className="z-10"
        >
          {accessory(cursor.insert)}
        </div>
      )}
      <div className="flex items-start gap-1.5">
        {icon && (
          <span className="text-muted-foreground mt-1 shrink-0 [&_svg]:size-3.5">{icon}</span>
        )}
        {multiline ? (
          <textarea
            ref={(el) => {
              inputRef.current = el
              cursor.setRef(el)
              referenceRef.current = el
            }}
            aria-label={label}
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            rows={1}
            className={cn(inputClassName, 'resize-none overflow-hidden')}
          />
        ) : (
          <input
            ref={(el) => {
              inputRef.current = el
              cursor.setRef(el)
              referenceRef.current = el
            }}
            type="text"
            aria-label={label}
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className={inputClassName}
          />
        )}
        {trailingAction?.({ draft, setDraft, preventNextBlurCommit })}
      </div>
    </Wrapper>
  )
}
