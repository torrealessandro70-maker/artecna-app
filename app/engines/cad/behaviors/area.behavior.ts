import type { CadAreaEntity } from '../entities'
import { boundingFromPoints } from '../geometry'
import type { CadEntityBehavior } from './types'

export const areaBehavior: CadEntityBehavior<CadAreaEntity> = {
  type: 'area',

  getBounds: entity =>
    boundingFromPoints(entity.points),

  getGripPoints: entity =>
    entity.points,

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