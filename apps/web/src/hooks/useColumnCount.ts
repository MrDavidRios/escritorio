import { useSyncExternalStore } from 'react'

// Mirrors Tailwind's `sm` (40rem) and `lg` (64rem) breakpoints.
const QUERIES = [
  { query: '(min-width: 64rem)', columns: 4 },
  { query: '(min-width: 40rem)', columns: 3 },
] as const
const BASE_COLUMNS = 2

function getColumnCount() {
  return QUERIES.find(({ query }) => window.matchMedia(query).matches)?.columns ?? BASE_COLUMNS
}

function subscribe(onChange: () => void) {
  const lists = QUERIES.map(({ query }) => window.matchMedia(query))
  lists.forEach((list) => list.addEventListener('change', onChange))
  return () => lists.forEach((list) => list.removeEventListener('change', onChange))
}

/** Column count for card grids: 2, 3 from `sm`, 4 from `lg`. */
export function useColumnCount() {
  return useSyncExternalStore(subscribe, getColumnCount, () => BASE_COLUMNS)
}
