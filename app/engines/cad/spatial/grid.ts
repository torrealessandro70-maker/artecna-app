export interface SpatialCell {
  x: number
  y: number
}

export const DEFAULT_GRID_SIZE = 128

export const getSpatialCell = (
  x: number,
  y: number,
  gridSize = DEFAULT_GRID_SIZE,
): SpatialCell => ({
  x: Math.floor(x / gridSize),
  y: Math.floor(y / gridSize),
})

export const getSpatialKey = (
  cell: SpatialCell,
): string =>
  `${cell.x}:${cell.y}`
