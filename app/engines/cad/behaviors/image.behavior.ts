import type { CadImageEntity } from '../entities'
import type { GeometryPoint } from '../geometry'
import type { CadEntityBehavior } from './types'

const getCornerPoints = (
  entity: CadImageEntity,
): GeometryPoint[] => {
  const { x, y, width, height } = entity.transform

  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ]
}

export const imageBehavior: CadEntityBehavior<CadImageEntity> = {
  type: 'image',

  getBounds: entity => {
    const { x, y, width, height } = entity.transform

    return {
      minX: x,
      minY: y,
      maxX: x + width,
      maxY: y + height,
    }
  },

  getGripPoints: entity =>
    getCornerPoints(entity),

  hitTest: (
    entity,
    point,
    tolerance,
  ) => {
    const bounds =
      imageBehavior.getBounds(entity)

    return (
      point.x >= bounds.minX - tolerance &&
      point.x <= bounds.maxX + tolerance &&
      point.y >= bounds.minY - tolerance &&
      point.y <= bounds.maxY + tolerance
    )
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
