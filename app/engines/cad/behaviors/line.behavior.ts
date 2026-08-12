import type { CadLineEntity } from '../entities'
import type { GeometryPoint } from '../geometry'
import type { CadEntityBehavior } from './types'

const distancePointToSegment = (
  point: GeometryPoint,
  start: GeometryPoint,
  end: GeometryPoint,
): number => {
  const dx = end.x - start.x
  const dy = end.y - start.y

  if (dx === 0 && dy === 0) {
    return Math.hypot(
      point.x - start.x,
      point.y - start.y,
    )
  }

  const segmentLengthSquared =
    dx * dx + dy * dy

  const projection = Math.max(
    0,
    Math.min(
      1,
      (
        (point.x - start.x) * dx +
        (point.y - start.y) * dy
      ) / segmentLengthSquared,
    ),
  )

  const closestPoint = {
    x: start.x + projection * dx,
    y: start.y + projection * dy,
  }

  return Math.hypot(
    point.x - closestPoint.x,
    point.y - closestPoint.y,
  )
}

export const lineBehavior: CadEntityBehavior<CadLineEntity> = {
  type: 'line',

  getBounds: entity => ({
    minX: Math.min(entity.start.x, entity.end.x),
    minY: Math.min(entity.start.y, entity.end.y),
    maxX: Math.max(entity.start.x, entity.end.x),
    maxY: Math.max(entity.start.y, entity.end.y),
  }),

  getGripPoints: entity => [
    entity.start,
    entity.end,
  ],

  hitTest: (
    entity,
    point,
    tolerance,
  ) =>
    distancePointToSegment(
      point,
      entity.start,
      entity.end,
    ) <= tolerance,

  move: (
    entity,
    dx,
    dy,
  ) => ({
    ...entity,
    start: {
      x: entity.start.x + dx,
      y: entity.start.y + dy,
    },
    end: {
      x: entity.end.x + dx,
      y: entity.end.y + dy,
    },
    updatedAt: new Date().toISOString(),
  }),
}
