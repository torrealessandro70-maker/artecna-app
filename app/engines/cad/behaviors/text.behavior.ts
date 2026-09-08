import type { CadTextEntity } from '../entities/types'
import { getCadTextLayout } from '../geometry/text-layout'
import type { CadEntityBehavior } from './types'

export const textBehavior: CadEntityBehavior<CadTextEntity> = {
  type: 'text',
  getBounds: entity => getCadTextLayout(entity).bounds,
  move: (entity, dx, dy) => ({
    ...entity,
    position: { x: entity.position.x + dx, y: entity.position.y + dy },
    updatedAt: new Date().toISOString(),
  }),
  // Approximate unrotated layout box, expanded by the existing CAD tolerance.
  hitTest: (entity, point, tolerance) => {
    if (entity.content.length === 0) return false
    const bounds = getCadTextLayout(entity).bounds
    return point.x >= bounds.minX - tolerance && point.x <= bounds.maxX + tolerance &&
      point.y >= bounds.minY - tolerance && point.y <= bounds.maxY + tolerance
  },
}
