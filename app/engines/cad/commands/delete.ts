import type {
  CadEntity,
  CadEntityId,
} from '../entities'
import type { CadCommandResult } from './types'

export const deleteEntities = (
  entities: CadEntity[],
  entityIds: CadEntityId[],
): CadCommandResult => {
  if (entityIds.length === 0) {
    return {
      entities,
      changed: false,
    }
  }

  const idsToDelete = new Set(entityIds)

  const updatedEntities = entities.filter(
    entity => !idsToDelete.has(entity.id),
  )

  if (updatedEntities.length === entities.length) {
    return {
      entities,
      changed: false,
    }
  }

  return {
    entities: updatedEntities,
    changed: true,
  }
}
