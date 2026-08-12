export type CadPoint = {
  x: number
  y: number
}

export const applyGridSnap = (
  point: CadPoint,
  gridSize: number,
): CadPoint => {
  if (gridSize <= 0) {
    return point
  }

  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  }
}
