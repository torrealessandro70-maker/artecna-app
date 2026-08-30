import type { CadRectangleEntity } from '../entities'
import type { CadEntityBehavior } from './types'

export const rectangleBehavior: CadEntityBehavior<CadRectangleEntity> = {
  type: 'rectangle',

  getBounds: entity => {
    const { x, y, width, height } = entity.transform

    return {
      minX: x,
      minY: y,
      maxX: x + width,
      maxY: y + height,
    }
  },

  move: (
    entity,
    dx,
    dy,
  ) => ({
    ...entity,
    transform: {
      ...entity.transform,
      x: entity.transform.x + dx,
      y: entity.transform.y + dy,
    },
    updatedAt: new Date().toISOString(),
  }),
}
