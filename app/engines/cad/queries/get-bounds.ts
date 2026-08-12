import type { CadEntity } from '../entities'
import type { GeometryBounds } from '../geometry'
import { getBehavior } from '../behaviors'

export const getEntityBounds = (
  entity: CadEntity,
): GeometryBounds | null => {
  const behavior = getBehavior(entity.type)

  return behavior?.getBounds
    ? behavior.getBounds(entity)
    : null
}

export const getEntitiesBounds = (
  entities: CadEntity[],
): GeometryBounds | null => {
  const bounds = entities
    .map(getEntityBounds)
    .filter(
      (value): value is GeometryBounds =>
        value !== null,
    )

  const firstBounds = bounds[0]

  if (!firstBounds) {
    return null
  }

  return bounds.slice(1).reduce<GeometryBounds>(
    (result, current) => ({
      minX: Math.min(result.minX, current.minX),
      minY: Math.min(result.minY, current.minY),
      maxX: Math.max(result.maxX, current.maxX),
      maxY: Math.max(result.maxY, current.maxY),
    }),
    firstBounds,
  )
}
