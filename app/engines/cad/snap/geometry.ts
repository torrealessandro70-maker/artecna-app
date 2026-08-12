import type {
  GeometryPoint,
} from '../geometry'

export const getDistance = (
  firstPoint: GeometryPoint,
  secondPoint: GeometryPoint,
): number => {
  const dx = secondPoint.x - firstPoint.x
  const dy = secondPoint.y - firstPoint.y

  return Math.hypot(dx, dy)
}

export const getMidpoint = (
  firstPoint: GeometryPoint,
  secondPoint: GeometryPoint,
): GeometryPoint => ({
  x: (firstPoint.x + secondPoint.x) / 2,
  y: (firstPoint.y + secondPoint.y) / 2,
})

export const isPointWithinTolerance = (
  point: GeometryPoint,
  target: GeometryPoint,
  tolerance: number,
): boolean =>
  getDistance(point, target) <= tolerance

export const getSegmentIntersection = (
  firstStart: GeometryPoint,
  firstEnd: GeometryPoint,
  secondStart: GeometryPoint,
  secondEnd: GeometryPoint,
): GeometryPoint | null => {
  const firstDeltaX =
    firstEnd.x - firstStart.x
  const firstDeltaY =
    firstEnd.y - firstStart.y

  const secondDeltaX =
    secondEnd.x - secondStart.x
  const secondDeltaY =
    secondEnd.y - secondStart.y

  const denominator =
    firstDeltaX * secondDeltaY -
    firstDeltaY * secondDeltaX

  if (Math.abs(denominator) < 0.000001) {
    return null
  }

  const startDeltaX =
    secondStart.x - firstStart.x
  const startDeltaY =
    secondStart.y - firstStart.y

  const firstParameter =
    (
      startDeltaX * secondDeltaY -
      startDeltaY * secondDeltaX
    ) / denominator

  const secondParameter =
    (
      startDeltaX * firstDeltaY -
      startDeltaY * firstDeltaX
    ) / denominator

  if (
    firstParameter < 0 ||
    firstParameter > 1 ||
    secondParameter < 0 ||
    secondParameter > 1
  ) {
    return null
  }

  return {
    x:
      firstStart.x +
      firstParameter * firstDeltaX,
    y:
      firstStart.y +
      firstParameter * firstDeltaY,
  }
}
