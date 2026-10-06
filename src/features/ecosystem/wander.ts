export interface Point {
  x: number
  y: number
}

export interface Zone {
  cx: number
  cy: number
  rx: number
  ry: number
}

/**
 * Where the robot's feet may go, in the 270 × 190 territory frame: the front part of the
 * floor, clear of the scene objects at the back and of the heading.
 */
export const WALK_ZONE: Zone = { cx: 135, cy: 146, rx: 92, ry: 16 }

/** Pixels per second, in map units. */
export const WALK_SPEED = 18
export const PAUSE_RANGE: readonly [number, number] = [2000, 5000]

const MIN_STEP = 0.25
const MAX_STEP = 0.7
const ATTEMPTS = 12
const EASING_TIME = 0.4

export function isInsideZone(point: Point, zone: Zone): boolean {
  const dx = (point.x - zone.cx) / zone.rx
  const dy = (point.y - zone.cy) / zone.ry
  return dx * dx + dy * dy <= 1 + 1e-9
}

export function pickDestination(zone: Zone, from: Point, random: () => number = Math.random): Point {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const angle = random() * Math.PI * 2
    const step = MIN_STEP + random() * (MAX_STEP - MIN_STEP)
    const candidate = {
      x: from.x + Math.cos(angle) * step * zone.rx,
      y: from.y + Math.sin(angle) * step * zone.ry,
    }
    if (isInsideZone(candidate, zone)) return candidate
  }
  return { x: (from.x + zone.cx) / 2, y: (from.y + zone.cy) / 2 }
}

export function travelDuration(from: Point, to: Point, speed = WALK_SPEED): number {
  return Math.hypot(to.x - from.x, to.y - from.y) / speed + EASING_TIME
}

export function pickPause(random: () => number = Math.random): number {
  return PAUSE_RANGE[0] + random() * (PAUSE_RANGE[1] - PAUSE_RANGE[0])
}

export function facingFor(from: Point, to: Point): 'left' | 'right' {
  return to.x < from.x ? 'left' : 'right'
}
