import { distance } from './geometry-utils'
import type { GeometryPoint } from './types'

export type SegmentCapsuleInterval = { t0: number; t1: number }

/**
 * Closed interval of P(t) = p0 + t * (p1 - p0) inside the capsule
 * swept from e0 to e1. Coordinates and radius must be finite, radius >= 0.
 * A covered degenerate stroke returns [0, 1]; tangency returns [t, t].
 * Radius is already effective: this helper does not add stroke thickness.
 */
export const segmentCapsuleInterval = (
  p0: GeometryPoint,
  p1: GeometryPoint,
  e0: GeometryPoint,
  e1: GeometryPoint,
  radius: number,
): SegmentCapsuleInterval | null => {
  if (
    !Number.isFinite(radius) || radius < 0 ||
    ![p0, p1, e0, e1].every(p => Number.isFinite(p.x) && Number.isFinite(p.y))
  ) {
    throw new RangeError('Expected finite coordinates and a non-negative finite radius')
  }

  const strokeLength = distance(p0, p1)
  const ux = strokeLength === 0 ? 0 : (p1.x - p0.x) / strokeLength
  const uy = strokeLength === 0 ? 0 : (p1.y - p0.y) / strokeLength
  let result: SegmentCapsuleInterval | null = null

  const include = (t0: number, t1: number) => {
    t0 = Math.max(0, t0)
    t1 = Math.min(1, t1)
    if (t0 > t1) return
    result = result
      ? { t0: Math.min(result.t0, t0), t1: Math.max(result.t1, t1) }
      : { t0, t1 }
  }

  const includeDisk = (center: GeometryPoint) => {
    if (strokeLength === 0) {
      if (distance(p0, center) <= radius) include(0, 1)
      return
    }
    const dx = center.x - p0.x
    const dy = center.y - p0.y
    const along = dx * ux + dy * uy
    const across = Math.abs(dx * uy - dy * ux)
    if (across > radius) return
    // Factor the chord instead of subtracting nearly equal squared distances.
    const halfChord = Math.sqrt(radius - across) * Math.sqrt(radius + across)
    include((along - halfChord) / strokeLength, (along + halfChord) / strokeLength)
  }

  includeDisk(e0)
  const eraserLength = distance(e0, e1)
  if (eraserLength === 0) return result
  includeDisk(e1)

  // Clip against the rectangle in the eraser's orthonormal frame.
  const vx = (e1.x - e0.x) / eraserLength
  const vy = (e1.y - e0.y) / eraserLength
  const dx = p0.x - e0.x
  const dy = p0.y - e0.y
  const sx = p1.x - p0.x
  const sy = p1.y - p0.y
  let t0 = 0
  let t1 = 1
  const clipSlab = (start: number, delta: number, min: number, max: number): boolean => {
    if (delta === 0) return start >= min && start <= max
    const a = (min - start) / delta
    const b = (max - start) / delta
    t0 = Math.max(t0, Math.min(a, b))
    t1 = Math.min(t1, Math.max(a, b))
    return t0 <= t1
  }
  if (
    clipSlab(dx * vx + dy * vy, sx * vx + sy * vy, 0, eraserLength) &&
    clipSlab(-dx * vy + dy * vx, -sx * vy + sy * vx, -radius, radius)
  ) {
    include(t0, t1)
  }
  // Rectangle + endpoint disks form a convex capsule: their intervals cannot
  // leave a gap, so their union is represented by its minimum and maximum t.
  return result
}
