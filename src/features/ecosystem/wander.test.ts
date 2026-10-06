import { describe, expect, it } from 'vitest'
import {
  facingFor,
  isInsideZone,
  PAUSE_RANGE,
  pickDestination,
  pickPause,
  travelDuration,
  WALK_ZONE,
} from './wander'
import type { Point } from './wander'

function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('pickDestination', () => {
  it('never leaves the walking zone', () => {
    const random = seeded(42)
    let position: Point = { x: WALK_ZONE.cx, y: WALK_ZONE.cy }
    for (let step = 0; step < 2000; step += 1) {
      position = pickDestination(WALK_ZONE, position, random)
      expect(isInsideZone(position, WALK_ZONE)).toBe(true)
    }
  })

  it('avoids tiny moves', () => {
    const random = seeded(7)
    const from = { x: WALK_ZONE.cx, y: WALK_ZONE.cy }
    for (let step = 0; step < 200; step += 1) {
      const to = pickDestination(WALK_ZONE, from, random)
      const normalised = Math.hypot((to.x - from.x) / WALK_ZONE.rx, (to.y - from.y) / WALK_ZONE.ry)
      expect(normalised).toBeGreaterThanOrEqual(0.25 - 1e-9)
    }
  })

  it('falls back towards the centre when no draw fits', () => {
    const edge = { x: WALK_ZONE.cx + WALK_ZONE.rx, y: WALK_ZONE.cy }
    const to = pickDestination(WALK_ZONE, edge, () => 0)
    expect(isInsideZone(to, WALK_ZONE)).toBe(true)
  })
})

describe('isInsideZone', () => {
  it('accepts the centre and rejects points outside the ellipse', () => {
    expect(isInsideZone({ x: WALK_ZONE.cx, y: WALK_ZONE.cy }, WALK_ZONE)).toBe(true)
    expect(isInsideZone({ x: WALK_ZONE.cx + WALK_ZONE.rx + 1, y: WALK_ZONE.cy }, WALK_ZONE)).toBe(false)
  })
})

describe('travelDuration', () => {
  it('walks at 18 px/s plus 0.4 s of easing', () => {
    expect(travelDuration({ x: 0, y: 0 }, { x: 36, y: 0 })).toBeCloseTo(2.4)
  })
})

describe('pickPause', () => {
  it('stays between 2 and 5 seconds', () => {
    expect(pickPause(() => 0)).toBe(PAUSE_RANGE[0])
    expect(pickPause(() => 0.999999)).toBeLessThan(PAUSE_RANGE[1])
  })
})

describe('facingFor', () => {
  it('faces the direction of travel', () => {
    expect(facingFor({ x: 10, y: 0 }, { x: 0, y: 0 })).toBe('left')
    expect(facingFor({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe('right')
  })
})
