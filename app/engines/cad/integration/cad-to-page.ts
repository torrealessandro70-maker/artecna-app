import type {
  PaginaQuadernoNota,
} from '@/app/components/note/types'

import {
  cadEntityToImage,
  cadEntityToSegno,
  type CadDimensionEntity,
  type CadEntity,
} from '../entities'

export const applyCadEntitiesToPage = (
  page: PaginaQuadernoNota,
  entities: CadEntity[],
): PaginaQuadernoNota => {
  const disegni = entities
    .map(cadEntityToSegno)
    .filter(
      (
        segno,
      ): segno is NonNullable<typeof segno> =>
        segno !== null,
    )

  const oggettiGrafici = entities
    .map(cadEntityToImage)
    .filter(
      (
        image,
      ): image is NonNullable<typeof image> =>
        image !== null,
    )

  const cadDimensions =
    entities.filter(
      (
        entity,
      ): entity is CadDimensionEntity =>
        entity.type === 'dimension',
    )

  return {
    ...page,
    disegni,
    oggettiGrafici,
    cadDimensions,
    cadEntities: entities.map((entity) => ({
      ...entity,
    })),
  }
}