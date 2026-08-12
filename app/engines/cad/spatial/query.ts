import { getSpatialCell, getSpatialKey } from "./grid"

import type { CadEntity } from "../entities/types"
import type { SpatialIndex } from "./index"

export const querySpatialIndex = (
  index: SpatialIndex,
  x: number,
  y: number,
  cellRadius = 1,
): CadEntity[] => {
  const centerCell = getSpatialCell(x, y)

  const entities = new Map<
    string,
    CadEntity
  >()

  for (
    let offsetX = -cellRadius;
    offsetX <= cellRadius;
    offsetX += 1
  ) {
    for (
      let offsetY = -cellRadius;
      offsetY <= cellRadius;
      offsetY += 1
    ) {
      const key = getSpatialKey({
        x: centerCell.x + offsetX,
        y: centerCell.y + offsetY,
      })

      const bucket = index.get(key)

      if (!bucket) continue

      for (const entity of bucket) {
        entities.set(entity.id, entity)
      }
    }
  }

  return [...entities.values()]
}
