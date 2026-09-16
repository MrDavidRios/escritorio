const SPANISH_HELPER_CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ñ'] as const

/**
 * A row of buttons for the accented letters Spanish uses (see
 * useCursorInsert for how a click lands the letter at the cursor).
 */
export function AccentedCharPad({ onInsert }: { onInsert: (char: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Spanish accented characters">
      {SPANISH_HELPER_CHARS.map((char) => (
        <button
          key={char}
          type="button"
          // Clicking these must not steal focus/selection from the input
          // they insert into -- mousedown normally would.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(char)}
          className="flex size-7 items-center justify-center rounded-md border border-input text-sm hover:bg-muted"
        >
          {char}
        </button>
      ))}
    </div>
  )
}
