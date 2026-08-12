import { getSpatialCell, getSpatialKey } from "./grid"
import { getCadEntityBounds } from "./bounds"

import type { CadEntity } from "../entities/types"

export type SpatialIndex = Map<
  string,
  CadEntity[]
>

export const buildSpatialIndex = (
  entities: CadEntity[],
): SpatialIndex => {
  const index: SpatialIndex = new Map()

  for (const entity of entities) {
    const bounds = getCadEntityBounds(entity)

    const startCell = getSpatialCell(
      bounds.minX,
      bounds.minY,
    )

    const endCell = getSpatialCell(
      bounds.maxX,
      bounds.maxY,
    )

    for (
      let cellX = startCell.x;
      cellX <= endCell.x;
      cellX += 1
    ) {
      for (
        let cellY = startCell.y;
        cellY <= endCell.y;
        cellY += 1
      ) {
        const key = getSpatialKey({
          x: cellX,
          y: cellY,
        })

        const bucket = index.get(key) ?? []

        if (
          !bucket.some(
            (item) => item.id === entity.id,
          )
        ) {
          bucket.push(entity)
        }

        index.set(key, bucket)
      }
    }
  }

  return index
}
