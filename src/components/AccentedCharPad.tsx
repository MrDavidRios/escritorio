const SPANISH_HELPER_CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ñ'] as const

/**
 * A toolbar of buttons for the accented letters Spanish uses (see
 * useCursorInsert for how a click lands the letter at the cursor).
 */
export function AccentedCharPad({ onInsert }: { onInsert: (char: string) => void }) {
  return (
    <div
      role="group"
      aria-label="Spanish accented characters"
      className="border-input bg-background inline-flex overflow-hidden rounded-md border shadow-sm"
    >
      {SPANISH_HELPER_CHARS.map((char, i) => (
        <button
          key={char}
          type="button"
          // Clicking these must not steal focus/selection from the input
          // they insert into -- mousedown normally would.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(char)}
          className={`hover:bg-muted flex size-7 items-center justify-center rounded-sm text-sm `}
        >
          {char}
        </button>
      ))}
    </div>
  )
}
