import { Children } from 'react'
import { useColumnCount } from '@/hooks/useColumnCount'

/**
 * Lays children out in columns that each keep their own height. Items are
 * dealt left to right (item i goes to column i % n), so reading order stays
 * row-major and an item never hops columns when its own height changes, e.g.
 * while a card is being edited.
 */
export function MasonryGrid({ children }: { children: React.ReactNode }) {
  const columnCount = useColumnCount()
  const columns: React.ReactNode[][] = Array.from({ length: columnCount }, () => [])
  Children.toArray(children).forEach((child, i) => columns[i % columnCount].push(child))

  return (
    <div className="flex items-start gap-4">
      {columns.map((items, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col gap-4">
          {items}
        </div>
      ))}
    </div>
  )
}
