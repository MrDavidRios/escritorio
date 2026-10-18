export type Selection = { start: number; end: number }

/**
 * Inserts `text` at the caret (replacing any selected range) and returns
 * the new value with the caret just after the insertion. A null or stale
 * selection appends at the end.
 */
export function insertAtSelection(
  value: string,
  selection: Selection | null,
  text: string,
): { value: string; selection: Selection } {
  const clamp = (n: number) => Math.min(Math.max(n, 0), value.length)
  const a = clamp(selection?.start ?? value.length)
  const b = clamp(selection?.end ?? value.length)
  const from = Math.min(a, b)
  const to = Math.max(a, b)
  const caret = from + text.length
  return {
    value: value.slice(0, from) + text + value.slice(to),
    selection: { start: caret, end: caret },
  }
}
