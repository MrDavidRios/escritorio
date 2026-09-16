import { useCallback, useRef } from 'react'

/**
 * Inserts text at an <input>'s current cursor position (replacing any
 * selection), rather than just appending to the end. Backed by a plain
 * DOM ref so it works with any value/onChange pair -- react-hook-form's
 * getValues/setValue, a useState pair, etc.
 */
export function useCursorInsert(getValue: () => string, setValue: (next: string) => void) {
  const ref = useRef<HTMLInputElement | null>(null)
  const setRef = useCallback((el: HTMLInputElement | null) => {
    ref.current = el
  }, [])

  function insert(text: string) {
    const input = ref.current
    const current = getValue()
    const start = input?.selectionStart ?? current.length
    const end = input?.selectionEnd ?? current.length
    setValue(current.slice(0, start) + text + current.slice(end))

    // The input's value updates on next render; wait for it before
    // restoring the cursor just past the inserted text.
    requestAnimationFrame(() => {
      if (!input) return
      input.focus()
      const pos = start + text.length
      input.setSelectionRange(pos, pos)
    })
  }

  return { setRef, insert }
}
