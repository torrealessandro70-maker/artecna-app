import type { CadEntity } from '../entities'
import type { GeometryPoint } from '../geometry'
import { getBehavior } from '../behaviors'

export type CadPointHitResult = {
  entity: CadEntity
  index: number
}

export const hitTestPoint = (
  entities: CadEntity[],
  point: GeometryPoint,
  tolerance: number,
): CadPointHitResult | null => {
  for (
    let index = entities.length - 1;
    index >= 0;
    index -= 1
  ) {
    const entity = entities[index]
    const behavior = getBehavior(entity.type)

    if (
      behavior?.hitTest?.(
        entity,
        point,
        tolerance,
      )
    ) {
      return {
        entity,
        index,
      }
    }
  }

  return null
}
