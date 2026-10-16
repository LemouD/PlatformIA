import { formatClockTime } from '@/lib/format'

/** Whole seconds left before the next reconnection attempt, never below zero. */
export function secondsUntil(retryAt: number, now: number): number {
  // The clock ticks on whole seconds, so rounding down never shows one second too many.
  return Math.max(0, Math.floor((retryAt - now) / 1000))
}

/** "Showing the last known state from 16:42:39. Reconnecting in 5 s." (design spec 15.4). */
export function interruptionDetail(lastKnownAt: number, retryAt: number | null, now: number): string {
  const lastKnown = `Showing the last known state from ${formatClockTime(lastKnownAt)}.`
  if (retryAt === null) return lastKnown
  const seconds = secondsUntil(retryAt, now)
  return seconds > 0 ? `${lastKnown} Reconnecting in ${seconds} s.` : `${lastKnown} Reconnecting…`
}
