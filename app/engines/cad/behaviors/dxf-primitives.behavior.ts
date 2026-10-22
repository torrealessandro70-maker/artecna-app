import type { CadCircleEntity, CadPolylineEntity } from '../entities'
import { boundingFromPoints } from '../geometry'
import type { CadEntityBehavior } from './types'
import { lineBehavior } from './line.behavior'

export const circleBehavior: CadEntityBehavior<CadCircleEntity> = {
  type: 'circle',
  getBounds: e => ({ minX: e.center.x - e.radius, minY: e.center.y - e.radius, maxX: e.center.x + e.radius, maxY: e.center.y + e.radius }),
  getGripPoints: e => [e.center, { x: e.center.x + e.radius, y: e.center.y }],
  hitTest: (e, p, tolerance) => Math.abs(Math.hypot(p.x - e.center.x, p.y - e.center.y) - e.radius) <= tolerance,
  move: (e, dx, dy) => ({ ...e, center: { x: e.center.x + dx, y: e.center.y + dy }, updatedAt: new Date().toISOString() }),
}
export const polylineBehavior: CadEntityBehavior<CadPolylineEntity> = {
  type: 'polyline',
  getBounds: e => e.points.length ? boundingFromPoints(e.points) : { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  getGripPoints: e => e.points,
  hitTest: (e, p, tolerance) => e.points.some((start, index) => {
    const end = e.points[index + 1] || (e.closed ? e.points[0] : undefined)
    return !!end && !!lineBehavior.hitTest?.({ ...e, type: 'line', start, end }, p, tolerance)
  }),
  move: (e, dx, dy) => ({ ...e, points: e.points.map(p => ({ x: p.x + dx, y: p.y + dy })), updatedAt: new Date().toISOString() }),
}
