import type {
  CadEntity,
  CadEntityId,
} from '../entities'
import {
  getBehavior,
  registerDefaultBehaviors,
} from '../behaviors'


import type { CadCommandResult } from './types'

const cloneCadEntity = (
  entity: CadEntity,
): CadEntity =>
  structuredClone(entity)

export const duplicateEntities = (
  entities: CadEntity[],
  entityIds: CadEntityId[],
  offsetX = 20,
  offsetY = 20,
): CadCommandResult => {

  registerDefaultBehaviors()

  if (entityIds.length === 0) {
    return {
      entities,
      changed: false,
    }
  }

  const idsToDuplicate = new Set(entityIds)
  const timestamp = new Date().toISOString()
  const duplicatedEntities: CadEntity[] = []

  entities.forEach(entity => {
    if (!idsToDuplicate.has(entity.id)) {
      return
    }

    const clonedEntity: CadEntity = {
      ...cloneCadEntity(entity),
      id: crypto.randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: entity.metadata
        ? {
            ...structuredClone(entity.metadata),
            sourceId: entity.id,
            sourceType: 'duplicate',
          }
        : {
            sourceId: entity.id,
            sourceType: 'duplicate',
          },
    }

    const behavior = getBehavior(
      clonedEntity.type,
    )

    const duplicatedEntity =
      behavior?.move &&
      (offsetX !== 0 || offsetY !== 0)
        ? behavior.move(
            clonedEntity,
            offsetX,
            offsetY,
          )
        : clonedEntity

    duplicatedEntities.push(
      duplicatedEntity,
    )
  })

  if (duplicatedEntities.length === 0) {
    return {
      entities,
      changed: false,
    }
  }

  return {
    entities: [
      ...entities,
      ...duplicatedEntities,
    ],
    changed: true,
    createdEntityIds: duplicatedEntities.map(
      entity => entity.id,
    ),
  }
}