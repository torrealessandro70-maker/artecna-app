import type { CadEntity } from '../entities'

import type { GeometryBounds } from '../geometry'

import { getBehavior } from '../behaviors'

export const getEntityBounds = (
  entity: CadEntity,
): GeometryBounds | null => {
  const behavior = getBehavior(entity.type)

  if (!behavior) {
    return null
  }

  return behavior.getBounds(entity)
}

export const getEntityBoundsOrThrow = (
  entity: CadEntity,
): GeometryBounds => {
  const bounds = getEntityBounds(entity)

  if (!bounds) {
    throw new Error(
      `No behavior registered for entity type "${entity.type}"`,
    )
  }

  return bounds
}

export const hasEntityBounds = (
  entity: CadEntity,
): boolean =>
  getBehavior(entity.type) !== undefined
