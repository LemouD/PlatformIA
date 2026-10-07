'use client'

import { useCallback, useState } from 'react'

/** Width of an element, kept up to date with ResizeObserver. Null until measured. */
export function useElementWidth<T extends HTMLElement>(): [
  (node: T | null) => (() => void) | undefined,
  number | null,
] {
  const [width, setWidth] = useState<number | null>(null)

  const ref = useCallback((node: T | null) => {
    if (!node) return undefined
    // Measure right away: ResizeObserver callbacks can be delayed while the page is hidden.
    setWidth(node.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}
