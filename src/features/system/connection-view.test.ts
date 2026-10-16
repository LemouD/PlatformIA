import { describe, expect, it } from 'vitest'
import { interruptionDetail, secondsUntil } from './connection-view'

const at = (h: number, m: number, s: number) => new Date(2026, 9, 14, h, m, s).getTime()

describe('interruption text', () => {
  it('says what is shown and when the next attempt comes', () => {
    expect(interruptionDetail(at(16, 42, 39), at(16, 42, 50), at(16, 42, 45))).toBe(
      'Showing the last known state from 16:42:39. Reconnecting in 5 s.',
    )
  })

  it('says it is reconnecting once the countdown is over, and stays quiet without an attempt', () => {
    expect(interruptionDetail(at(16, 42, 39), at(16, 42, 50), at(16, 42, 51))).toBe(
      'Showing the last known state from 16:42:39. Reconnecting…',
    )
    expect(interruptionDetail(at(16, 42, 39), null, at(16, 42, 51))).toBe('Showing the last known state from 16:42:39.')
  })

  it('rounds the countdown down and never goes negative', () => {
    expect(secondsUntil(10_000, 5_000)).toBe(5)
    expect(secondsUntil(10_000, 5_100)).toBe(4)
    expect(secondsUntil(10_000, 12_000)).toBe(0)
  })
})
