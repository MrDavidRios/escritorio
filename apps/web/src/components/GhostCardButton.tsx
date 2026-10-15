import { cn } from '@/lib/utils'

/**
 * A dashed, empty-looking card that acts as a button: the "add one more" slot at the end of a
 * card grid. Lifts with a soft shadow on hover, like the real cards beside it. Spreads props and
 * the ref onto the <button> so it works as a Radix `asChild` trigger.
 */
export function GhostCardButton({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'ease-out-strong after:ease-out-strong border-foreground/20 text-muted-foreground hover:border-foreground/40 hover:bg-muted/50 hover:text-foreground focus-visible:ring-ring/50 relative isolate flex min-h-24 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium transition-[translate,color,background-color,border-color] duration-200 outline-none after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-xl after:opacity-0 after:shadow-lg after:transition-opacity after:duration-200 hover:-translate-y-0.5 hover:after:opacity-100 focus-visible:ring-3 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        className,
      )}
      {...props}
    />
  )
}
