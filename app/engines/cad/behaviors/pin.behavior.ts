import type { CadPinEntity } from '../entities'
import type { CadEntityBehavior } from './types'

const PIN_HALF_SIZE = 8

export const pinBehavior: CadEntityBehavior<CadPinEntity> = {
  type: 'pin',

  getBounds: entity => ({
    minX: entity.position.x - PIN_HALF_SIZE,
    minY: entity.position.y - PIN_HALF_SIZE,
    maxX: entity.position.x + PIN_HALF_SIZE,
    maxY: entity.position.y + PIN_HALF_SIZE,
  }),

  getGripPoints: entity => [
    entity.position,
  ],

  move: (
    entity,
    dx,
    dy,
  ) => ({
    ...entity,
    position: {
      x: entity.position.x + dx,
      y: entity.position.y + dy,
    },
    updatedAt: new Date().toISOString(),
  }),
}
