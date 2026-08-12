import type {
  GeometryBounds,
  GeometryPoint,
} from './types'

export const distance = (
  a: GeometryPoint,
  b: GeometryPoint,
): number =>
  Math.hypot(b.x - a.x, b.y - a.y)

export const midpoint = (
  a: GeometryPoint,
  b: GeometryPoint,
): GeometryPoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
})

export const translatePoint = (
  point: GeometryPoint,
  dx: number,
  dy: number,
): GeometryPoint => ({
  x: point.x + dx,
  y: point.y + dy,
})

export const boundingFromPoints = (
  points: GeometryPoint[],
): GeometryBounds => {
  if (points.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    }
  }

  let minX = points[0].x
  let minY = points[0].y
  let maxX = points[0].x
  let maxY = points[0].y

  for (const point of points) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
  }
}
export const perpendicularDirection = (
  start: GeometryPoint,
  end: GeometryPoint,
): GeometryPoint | null => {
  const dx = end.x - start.x
  const dy = end.y - start.y

  const length = Math.hypot(dx, dy)

  if (length === 0) {
    return null
  }

  return {
    x: -dy / length,
    y: dx / length,
  }
}