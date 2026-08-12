import type {
  CadDimensionEntity,
} from '../entities'

import type {
  CadEntityBehavior,
} from './types'

export const dimensionBehavior: CadEntityBehavior<CadDimensionEntity> = {
  type: 'dimension',

  getBounds: entity => ({
    minX: Math.min(
      entity.start.x,
      entity.end.x,
    ),
    minY: Math.min(
      entity.start.y,
      entity.end.y,
    ),
    maxX: Math.max(
      entity.start.x,
      entity.end.x,
    ),
    maxY: Math.max(
      entity.start.y,
      entity.end.y,
    ),
  }),

  getGripPoints: entity => [
    entity.start,
    entity.end,
  ],

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
