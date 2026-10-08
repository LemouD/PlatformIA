'use client'

import { useSyncExternalStore } from 'react'

function subscribeEvery(intervalMs: number) {
  return (onChange: () => void) => {
    const id = setInterval(onChange, intervalMs)
    return () => clearInterval(id)
  }
}

const subscribers = new Map<number, (onChange: () => void) => () => void>()

/** Current time, refreshed every `intervalMs`; null during server rendering. */
export function useNow(intervalMs = 1000): number | null {
  let subscribe = subscribers.get(intervalMs)
  if (!subscribe) {
    subscribe = subscribeEvery(intervalMs)
    subscribers.set(intervalMs, subscribe)
  }
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => null,
  )
}
