import type {
  CadEntity,
  CadEntityId,
  CadTransform,
} from '../entities'

import type {
  CadCommandResult,
} from './types'

const supportsTransform = (
  entity: CadEntity,
): entity is Extract<
  CadEntity,
  {
    type: 'image' | 'rectangle' | 'symbol'
  }
> =>
  entity.type === 'image' ||
  entity.type === 'rectangle' ||
  entity.type === 'symbol'

const transformsAreEqual = (
  current: CadTransform,
  next: CadTransform,
): boolean =>
  current.x === next.x &&
  current.y === next.y &&
  current.width === next.width &&
  current.height === next.height &&
  current.rotation === next.rotation &&
  current.scaleX === next.scaleX &&
  current.scaleY === next.scaleY

export const transformEntity = (
  entities: CadEntity[],
  entityId: CadEntityId,
  transform: CadTransform,
): CadCommandResult => {
  let changed = false

  const updatedEntities = entities.map(
    (entity) => {
      if (
        entity.id !== entityId ||
        !supportsTransform(entity)
      ) {
        return entity
      }

      if (
        entity.locked ||
        transformsAreEqual(
          entity.transform,
          transform,
        )
      ) {
        return entity
      }

      changed = true

      return {
        ...entity,
        transform: {
          ...transform,
        },
        updatedAt: new Date().toISOString(),
      }
    },
  )

  return {
    entities: changed
      ? updatedEntities
      : entities,
    changed,
  }
}
