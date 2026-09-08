import type { CadEntity, CadPoint } from '../entities/types'
import type { GeometryBounds } from '../geometry/types'
import { segmentIntersection } from '../geometry/intersections'
import { getCadEntityBounds } from '../spatial/bounds'

export type CadMarqueeMode = 'containment' | 'crossing'

/** Pure geometry; callers own visibility, locking and layer filters.
 * Rectangle/text bounds ignore rotation; freehand bounds ignore stroke width.
 * Rectangle/freehand/text crossing uses bounds, not exact painted geometry.
 * Marquee bounds must be finite and ordered. Boundary contact is included.
 */
export const intersectsCadMarquee = (
  entity: CadEntity,
  marquee: GeometryBounds,
  mode: CadMarqueeMode,
): boolean => {
  const { minX, minY, maxX, maxY } = marquee
  if (![minX, minY, maxX, maxY].every(Number.isFinite) || minX > maxX || minY > maxY) return false
  const inside = (p: CadPoint) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
  const corners = [
    { x: minX, y: minY }, { x: maxX, y: minY },
    { x: maxX, y: maxY }, { x: minX, y: maxY },
  ]
  const crosses = (a: CadPoint, b: CadPoint) => inside(a) || inside(b) ||
    corners.some((corner, i) => segmentIntersection(a, b, corner, corners[(i + 1) % 4]) !== null)

  if (entity.type === 'line') {
    return mode === 'containment' ? inside(entity.start) && inside(entity.end) : crosses(entity.start, entity.end)
  }
  if (entity.type === 'area') {
    const points = entity.points
    if (points.length < 3) return false
    if (mode === 'containment') return points.every(inside)
    if (points.some((point, i) => crosses(point, points[(i + 1) % points.length]))) return true
    // No boundary crossing: include a marquee wholly enclosed by the area.
    const point = corners[0]
    let enclosed = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i], b = points[j]
      if ((a.y > point.y) !== (b.y > point.y) &&
          point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) enclosed = !enclosed
    }
    return enclosed
  }
  if (entity.type !== 'rectangle' && entity.type !== 'freehand' && entity.type !== 'text') return false
  if (entity.type === 'freehand' && entity.points.length === 0) return false
  if (entity.type === 'text' && entity.content.length === 0) return false
  const bounds = getCadEntityBounds(entity)
  return mode === 'containment'
    ? bounds.minX >= minX && bounds.maxX <= maxX && bounds.minY >= minY && bounds.maxY <= maxY
    : bounds.maxX >= minX && bounds.minX <= maxX && bounds.maxY >= minY && bounds.minY <= maxY
}
