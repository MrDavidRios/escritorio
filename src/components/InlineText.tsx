import { useEffect, useRef, useState } from 'react'
import { useCursorInsert } from '@/hooks/useCursorInsert'
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
}: InlineTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const focusButtonOnExit = useRef(false)
  const skipBlurCommit = useRef(false)
  const cursor = useCursorInsert(
    () => draft,
    (next) => setDraft(next),
  )

  useEffect(() => {
    if (!editing) return
    const el = inputRef.current
    if (!el) return
    el.focus()
    const end = el.value.length
    el.setSelectionRange(end, end)
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

  function startEditing() {
    setDraft(value)
    setEditing(true)
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
      <Wrapper className={className}>
        <button
          ref={buttonRef}
          type="button"
          aria-label={label}
          onClick={startEditing}
          className={cn(
            BOX,
            'hover:bg-muted/60 focus-visible:bg-muted/60 block w-full max-w-full text-left transition-colors duration-150',
            !value && 'text-muted-foreground',
            multiline && 'whitespace-pre-wrap',
          )}
        >
          {value || placeholder}
        </button>
      </Wrapper>
    )
  }

  const inputClassName = cn(
    BOX,
    'block w-full max-w-full bg-background text-inherit outline-none ring-1 ring-ring [font:inherit] [letter-spacing:inherit]',
  )

  return (
    <Wrapper className={className}>
      {accessory?.(cursor.insert)}
      {multiline ? (
        <textarea
          ref={(el) => {
            inputRef.current = el
            cursor.setRef(el)
          }}
          aria-label={label}
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
          }}
          type="text"
          aria-label={label}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={inputClassName}
        />
      )}
    </Wrapper>
  )
}
