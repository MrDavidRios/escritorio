import favicon from '@/assets/favicon-32x32.png'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return <img src={favicon} alt="" className={cn('size-6', className)} />
}
