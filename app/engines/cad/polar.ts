export type CadPoint = {
  x: number
  y: number
}

export const applyPolar = (
  origin: CadPoint,
  point: CadPoint,
  increment = 45,
  tolerance = 8,
): CadPoint => {
  const dx = point.x - origin.x
  const dy = point.y - origin.y

  const distance = Math.hypot(dx, dy)

  if (distance === 0) {
    return point
  }

  const angle =
    (Math.atan2(dy, dx) * 180) / Math.PI

  const normalized =
    (angle + 360) % 360

  const snapped =
    Math.round(normalized / increment) *
    increment

  const diff = Math.min(
    Math.abs(snapped - normalized),
    360 - Math.abs(snapped - normalized),
  )

  if (diff > tolerance) {
    return point
  }

  const radians =
    (snapped * Math.PI) / 180

  return {
    x:
      origin.x +
      Math.cos(radians) * distance,
    y:
      origin.y +
      Math.sin(radians) * distance,
  }
}
