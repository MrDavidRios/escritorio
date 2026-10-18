/** Fills as cards are answered; screen readers read it as "Card i of n". */
export function ProgressBar({
  answered,
  current,
  total,
}: {
  answered: number
  current: number
  total: number
}) {
  return (
    <div
      role="progressbar"
      aria-label="Progress"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={answered}
      aria-valuetext={`Card ${current} of ${total}`}
      className="bg-muted h-2 w-full overflow-hidden rounded-full"
    >
      <div
        className="bg-brand h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${(answered / total) * 100}%` }}
      />
    </div>
  )
}
