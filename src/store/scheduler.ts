/** Time source and timers, injectable so tests can move time forward without waiting. */
export interface Scheduler {
  now(): number
  setTimeout(callback: () => void, delayMs: number): unknown
  clearTimeout(handle: unknown): void
}

export const browserScheduler: Scheduler = {
  now: () => Date.now(),
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
}

/** Deterministic scheduler for tests: time only moves when `advance` is called. */
export function createManualScheduler(start = 0) {
  let time = start
  let nextHandle = 1
  const timers = new Map<number, { at: number; callback: () => void }>()

  const scheduler: Scheduler & { advance(ms: number): void; pending(): number } = {
    now: () => time,
    setTimeout(callback, delayMs) {
      const handle = nextHandle
      nextHandle += 1
      timers.set(handle, { at: time + Math.max(0, delayMs), callback })
      return handle
    },
    clearTimeout(handle) {
      timers.delete(handle as number)
    },
    advance(ms) {
      const target = time + ms
      for (;;) {
        let next: [number, { at: number; callback: () => void }] | undefined
        for (const entry of timers) {
          if (entry[1].at <= target && (!next || entry[1].at < next[1].at)) next = entry
        }
        if (!next) break
        timers.delete(next[0])
        time = next[1].at
        next[1].callback()
      }
      time = target
    },
    pending: () => timers.size,
  }
  return scheduler
}
