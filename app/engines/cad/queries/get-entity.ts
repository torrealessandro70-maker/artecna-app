import type { CadEntity } from '../entities'

export const getEntityById = (
  entities: CadEntity[],
  entityId: string,
): CadEntity | undefined =>
  entities.find(entity => entity.id === entityId)

export const getEntitiesByIds = (
  entities: CadEntity[],
  entityIds: string[],
): CadEntity[] => {
  const idSet = new Set(entityIds)

  return entities.filter(entity =>
    idSet.has(entity.id),
  )
}
