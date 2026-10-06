import { describe, expect, it } from 'vitest'
import { computeOrbitLayout, MAP_WIDTH } from './orbit'
import type { Rect } from './orbit'

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function inside(rect: Rect, width: number, height: number): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height
}

describe('computeOrbitLayout', () => {
  it('reproduces the mockup corners for four agents', () => {
    const layout = computeOrbitLayout(4)
    expect(layout.scale).toBe(1)
    expect(layout.height).toBe(560)
    expect(layout.center).toEqual({ x: 304, y: 208, width: 220, height: 210 })
    expect(layout.territories.map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [568, 0],
      [0, 350],
      [568, 350],
    ])
  })

  it('fills the top corners first when there are fewer than four agents', () => {
    expect(computeOrbitLayout(2).territories.map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [568, 0],
    ])
  })

  for (let count = 0; count <= 12; count += 1) {
    it(`places ${count} agents without overlap and inside the map`, () => {
      const layout = computeOrbitLayout(count)
      expect(layout.width).toBe(MAP_WIDTH)
      expect(layout.territories).toHaveLength(count)
      for (const [index, rect] of layout.territories.entries()) {
        expect(inside(rect, layout.width, layout.height)).toBe(true)
        expect(overlaps(rect, layout.center)).toBe(false)
        for (const other of layout.territories.slice(index + 1)) {
          expect(overlaps(rect, other)).toBe(false)
        }
      }
      expect(inside(layout.center, layout.width, layout.height)).toBe(true)
    })
  }

  it('keeps every territory the same size beyond four agents', () => {
    const sizes = computeOrbitLayout(8).territories.map(({ width, height }) => `${width}x${height}`)
    expect(new Set(sizes).size).toBe(1)
  })

  it('does not move existing agents when another one arrives', () => {
    for (let count = 5; count < 12; count += 1) {
      const before = computeOrbitLayout(count)
      const after = computeOrbitLayout(count + 1)
      if (after.height !== before.height) continue
      expect(after.territories.slice(0, count)).toEqual(before.territories)
    }
  })

  it('fills corners, then top, bottom, left and right', () => {
    const layout = computeOrbitLayout(8)
    const cell = (rect: Rect) => [Math.floor(rect.x / 280), Math.floor(rect.y / (560 / 3))]
    expect(layout.territories.map(cell)).toEqual([
      [0, 0],
      [2, 0],
      [0, 2],
      [2, 2],
      [1, 0],
      [1, 2],
      [0, 1],
      [2, 1],
    ])
  })

  it('keeps robots at least 60 px tall', () => {
    for (let count = 0; count <= 12; count += 1) {
      expect(84 * computeOrbitLayout(count).scale).toBeGreaterThanOrEqual(60)
    }
  })

  it('grows the map beyond eight agents', () => {
    expect(computeOrbitLayout(8).height).toBe(560)
    expect(computeOrbitLayout(9).height).toBeGreaterThan(560)
  })

  it('keeps NOVA vertically centred', () => {
    for (const count of [5, 9, 12]) {
      const layout = computeOrbitLayout(count)
      const middle = layout.center.y + layout.center.height / 2
      expect(middle).toBeCloseTo(layout.height / 2)
    }
  })

  it('rejects invalid counts', () => {
    expect(() => computeOrbitLayout(-1)).toThrow(RangeError)
    expect(() => computeOrbitLayout(1.5)).toThrow(RangeError)
  })
})
