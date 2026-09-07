import type { CadFreehandEntity, CadPoint } from '../entities/types'
import { segmentCapsuleInterval } from '../geometry/erase'
import { distance } from '../geometry/geometry-utils'

export type EraseFreehandResult = {
  changed: boolean
  entities: CadFreehandEntity[]
}

export type EraseFreehandOptions = {
  createId?: () => string
  now?: () => string
}

// Sixteen machine epsilons at the local coordinate scale: roundoff allowance,
// not a visual threshold. Compare lengths, not t, so long segments retain cuts.
const roundoff = (a: CadPoint, b: CadPoint, radius: number): number =>
  16 * Number.EPSILON * Math.max(
    1, Math.abs(a.x), Math.abs(a.y), Math.abs(b.x), Math.abs(b.y), radius,
  )

/** Apply one capsule sweep to one freehand, without mutating it or filtering
 * by tool, layer, visibility or lock state. Unchanged input is returned by
 * reference. No invalid fragments are created; untouched input is not repaired.
 */
export const eraseFreehand = (
  entity: CadFreehandEntity,
  e0: CadPoint,
  e1: CadPoint,
  eraserRadius: number,
  options: EraseFreehandOptions = {},
): EraseFreehandResult => {
  if (!Number.isFinite(eraserRadius) || eraserRadius < 0 ||
      !Number.isFinite(entity.stroke.width) || entity.stroke.width < 0) {
    throw new RangeError('Expected non-negative finite eraser radius and stroke width')
  }
  const radius = eraserRadius + entity.stroke.width / 2
  const fragments: CadPoint[][] = []
  let current: CadPoint[] = []
  let changed = false

  const append = (point: CadPoint) => {
    const last = current[current.length - 1]
    if (!last || distance(last, point) > roundoff(last, point, radius)) {
      current.push(point)
    }
  }
  const flush = () => {
    if (current.length >= 2) fragments.push(current)
    current = []
  }
  const interpolate = (a: CadPoint, b: CadPoint, t: number): CadPoint => {
    if (t === 0) return a
    if (t === 1) return b
    return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
  }

  for (let i = 0; i + 1 < entity.points.length; i++) {
    const a = entity.points[i]
    const b = entity.points[i + 1]
    const interval = segmentCapsuleInterval(a, b, e0, e1, radius)
    const length = distance(a, b)
    const tolerance = roundoff(a, b, radius)
    // Repeated points carry no positive-length portion to erase. Ignoring
    // them also prevents a boundary point from disconnecting a tangent path.
    if (!interval || (interval.t1 - interval.t0) * length <= tolerance) {
      append(a)
      append(b)
      continue
    }

    changed = true
    if (interval.t0 * length > tolerance) {
      append(a)
      append(interpolate(a, b, interval.t0))
    }
    flush()
    if ((1 - interval.t1) * length > tolerance) {
      append(interpolate(a, b, interval.t1))
      append(b)
    }
  }
  if (!changed) return { changed: false, entities: [entity] }
  flush()

  // Shallow spreading preserves all base/extension properties. Points, stroke
  // and metadata are never mutated. Generate IDs only for additional survivors.
  const updatedAt = fragments.length ? (options.now ?? (() => new Date().toISOString()))() : ''
  return {
    changed: true,
    entities: fragments.map((points, index) => ({
      ...entity,
      points,
      id: index === 0 ? entity.id : (options.createId ?? (() => crypto.randomUUID()))(),
      updatedAt,
    })),
  }
}
