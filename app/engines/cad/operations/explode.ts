import type {
  CadAreaEntity,
  CadEntity,
} from "../entities"

import {
  createCadLine,
} from "../entities/entity-factory"

export type ExplodeCadEntityResult = {
  changed: boolean
  entities: CadEntity[]
}

export function explodeCadAreaEntity(
  entity: CadAreaEntity,
): ExplodeCadEntityResult {
  if (entity.points.length < 2) {
    return {
      changed: false,
      entities: [entity],
    }
  }

  const linee: CadEntity[] = []

  for (
    let index = 0;
    index < entity.points.length;
    index++
  ) {
    const start = entity.points[index]

    const end =
      entity.points[
        (index + 1) %
          entity.points.length
      ]

    linee.push(
      createCadLine({
        layerId: entity.layerId,

        start: {
          x: start.x,
          y: start.y,
        },

        end: {
          x: end.x,
          y: end.y,
        },

        stroke: entity.stroke,

        visible: entity.visible,
        locked: entity.locked,
        selectable: entity.selectable,

        metadata: {
          ...entity.metadata,
          explodedFromEntityId: entity.id,
        },
      }),
    )
  }

  return {
    changed: true,
    entities: linee,
  }
}