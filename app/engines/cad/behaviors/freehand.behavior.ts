import type { CadFreehandEntity } from '../entities'
import { boundingFromPoints } from '../geometry'
import type { CadEntityBehavior } from './types'

export const freehandBehavior: CadEntityBehavior<CadFreehandEntity> = {
  type: 'freehand',

  getBounds: entity =>
    boundingFromPoints(entity.points),

  getGripPoints: entity => {
    if (entity.points.length === 0) {
      return []
    }

    return [
      entity.points[0],
      entity.points[entity.points.length - 1],
    ]
  },

  move: (
    entity,
    dx,
    dy,
  ) => ({
    ...entity,
    points: entity.points.map(point => ({
      x: point.x + dx,
      y: point.y + dy,
    })),
    updatedAt: new Date().toISOString(),
  }),
}
