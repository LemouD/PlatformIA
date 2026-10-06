export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface OrbitLayout {
  width: number
  height: number
  center: Rect
  territories: Rect[]
  /** Scale applied to territories and the robots inside them. */
  scale: number
}

export const MAP_WIDTH = 840
export const BASE_MAP_HEIGHT = 560
export const TERRITORY_WIDTH = 270
export const TERRITORY_HEIGHT = 190
export const CENTER_WIDTH = 220
export const CENTER_HEIGHT = 210

const MOCKUP_CENTER: Rect = { x: 304, y: 208, width: CENTER_WIDTH, height: CENTER_HEIGHT }

const MOCKUP_CORNERS: readonly Rect[] = [
  { x: 0, y: 0, width: TERRITORY_WIDTH, height: TERRITORY_HEIGHT },
  { x: 568, y: 0, width: TERRITORY_WIDTH, height: TERRITORY_HEIGHT },
  { x: 0, y: 350, width: TERRITORY_WIDTH, height: TERRITORY_HEIGHT },
  { x: 568, y: 350, width: TERRITORY_WIDTH, height: TERRITORY_HEIGHT },
]

const COLUMNS = 3
const CELL_WIDTH = MAP_WIDTH / COLUMNS
const CELL_HEIGHT = BASE_MAP_HEIGHT / 3
const CELL_FILL = 0.96

interface Cell {
  row: number
  col: number
}

function ringRows(count: number): number {
  let rows = 3
  while (COLUMNS * rows - 1 < count) rows += 2
  return rows
}

/** Ring first, then corners, top middle, bottom middle, left side, right side. */
function cellOrder({ row, col }: Cell, centerRow: number): [number, number] {
  const dr = row - centerRow
  const dc = col - 1
  const ring = Math.max(Math.abs(dr), Math.abs(dc))
  if (Math.abs(dr) === ring && dc !== 0) return [ring, (dr < 0 ? 0 : 2) + (dc < 0 ? 0 : 1)]
  if (dr === -ring) return [ring, 4]
  if (dr === ring) return [ring, 5]
  if (dc < 0) return [ring, 6 + dr + ring]
  return [ring, 7 + 3 * ring + dr]
}

function fitIn(cell: Cell, width: number, height: number): Rect {
  return {
    x: cell.col * CELL_WIDTH + (CELL_WIDTH - width) / 2,
    y: cell.row * CELL_HEIGHT + (CELL_HEIGHT - height) / 2,
    width,
    height,
  }
}

export function computeOrbitLayout(count: number): OrbitLayout {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`Agent count must be a non-negative integer, got ${count}`)
  }

  if (count <= 4) {
    return {
      width: MAP_WIDTH,
      height: BASE_MAP_HEIGHT,
      center: MOCKUP_CENTER,
      territories: MOCKUP_CORNERS.slice(0, count),
      scale: 1,
    }
  }

  const rows = ringRows(count)
  const centerRow = (rows - 1) / 2
  const scale = Math.min(CELL_WIDTH / TERRITORY_WIDTH, CELL_HEIGHT / TERRITORY_HEIGHT) * CELL_FILL
  const centerScale = Math.min(CELL_WIDTH / CENTER_WIDTH, CELL_HEIGHT / CENTER_HEIGHT) * CELL_FILL

  const cells: Cell[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < COLUMNS; col += 1) {
      if (row !== centerRow || col !== 1) cells.push({ row, col })
    }
  }
  cells.sort((a, b) => {
    const [ringA, orderA] = cellOrder(a, centerRow)
    const [ringB, orderB] = cellOrder(b, centerRow)
    return ringA - ringB || orderA - orderB
  })

  return {
    width: MAP_WIDTH,
    height: rows * CELL_HEIGHT,
    center: fitIn({ row: centerRow, col: 1 }, CENTER_WIDTH * centerScale, CENTER_HEIGHT * centerScale),
    territories: cells
      .slice(0, count)
      .map((cell) => fitIn(cell, TERRITORY_WIDTH * scale, TERRITORY_HEIGHT * scale)),
    scale,
  }
}
