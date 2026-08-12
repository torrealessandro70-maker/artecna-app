import { getDistance } from './geometry'
import { getEntitySnapPoints } from './providers'

import type {
  SnapPoint,
  SnapResolveOptions,
} from './types'

export const resolveSnapPoint = ({
  entities,
  cursor,
  tolerance,
  enabledTypes,
}: SnapResolveOptions): SnapPoint | null => {
  const usableEntities = entities.filter(entity => {
    return (
      entity.visible !== false &&
      entity.locked !== true &&
      entity.selectable !== false
    )
  })

  const context = {
    entities: usableEntities,
  }

const snapPoints = usableEntities.flatMap(
  entity =>
    getEntitySnapPoints(
      entity,
      context,
    ),
)

console.log('SNAP RESOLVER', {
  cursor,
  tolerance,
  entitiesRicevute: entities.length,
  usableEntities: usableEntities.map(
    entity => ({
      id: entity.id,
      type: entity.type,
      visible: entity.visible,
      locked: entity.locked,
      selectable: entity.selectable,
    }),
  ),
  snapPoints,
  distanze: snapPoints.map(point => ({
    point,
    distance: getDistance(
      cursor,
      point,
    ),
  })),
})

const candidates = snapPoints
  .filter(candidate =>
    enabledTypes
      ? enabledTypes.includes(candidate.type)
      : true,
  )
  .map(candidate => ({
    candidate,
    distance: getDistance(
      cursor,
      candidate,
    ),
  }))

    .filter(
      item =>
        item.distance <= tolerance,
    )
    .sort((first, second) => {
      if (
        first.candidate.priority !==
        second.candidate.priority
      ) {
        return (
          second.candidate.priority -
          first.candidate.priority
        )
      }

      return first.distance - second.distance
    })

console.log("CANDIDATI FINALI", candidates)

  const risultato =
  candidates[0]?.candidate ?? null

console.log("RISULTATO SNAP", {
  risultato,
  distanza:
    candidates[0]?.distance,
})

return risultato
}