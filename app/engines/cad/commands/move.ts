import type {
  CadEntity,
  CadEntityId,
} from '../entities'
import { getBehavior } from '../behaviors'
import type { CadCommandResult } from './types'

export const moveEntities = (
  entities: CadEntity[],
  entityIds: CadEntityId[],
  dx: number,
  dy: number,
): CadCommandResult => {
  if (
    entityIds.length === 0 ||
    (dx === 0 && dy === 0)
  ) {
    return {
      entities,
      changed: false,
    }
  }

  const idsToMove = new Set(entityIds)
  let changed = false

  const updatedEntities = entities.map(entity => {
    if (!idsToMove.has(entity.id)) {
      return entity
    }

    const behavior = getBehavior(entity.type)

    if (!behavior?.move) {
      return entity
    }

    changed = true

    return behavior.move(
      entity,
      dx,
      dy,
    )
  })

  return {
    entities: changed
      ? updatedEntities
      : entities,
    changed,
  }
}
