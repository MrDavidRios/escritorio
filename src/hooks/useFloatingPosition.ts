import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'
import { useEffect, useRef, useState, type DependencyList } from 'react'

/**
 * Positions a floating element (e.g. a toolbar) above a reference element,
 * flipping below and/or shifting sideways when there isn't room to stay on
 * top -- same collision-avoidance Radix's Popper primitive does internally,
 * without pulling in its portal/dismiss machinery.
 *
 * `deps` should include anything that changes which DOM nodes the refs
 * point at (e.g. a flag that swaps the reference/floating elements for
 * different ones across renders), so the position recomputes against the
 * current nodes.
 */
export function useFloatingPosition<
  TReference extends HTMLElement = HTMLElement,
  TFloating extends HTMLElement = HTMLElement,
>(active: boolean, deps: DependencyList = []) {
  const referenceRef = useRef<TReference>(null)
  const floatingRef = useRef<TFloating>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!active) return
    const reference = referenceRef.current
    const floating = floatingRef.current
    if (!reference || !floating) return
    return autoUpdate(reference, floating, () => {
      computePosition(reference, floating, {
        placement: 'top',
        middleware: [offset(6), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => setPosition({ x, y }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps])

  return { referenceRef, floatingRef, position }
}
