import type { ReactNode } from 'react'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'

/** Every screen's root: theme background, safe-area padding. */
export function Screen({ children, edges = ['bottom'] }: { children: ReactNode; edges?: Edge[] }) {
  return (
    <SafeAreaView edges={edges} className="flex-1 bg-background">
      {children}
    </SafeAreaView>
  )
}
