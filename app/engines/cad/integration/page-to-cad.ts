import type {
  PaginaQuadernoNota,
} from '@/app/components/note/types'

import {
  imageToCadEntity,
  segnoToCadEntity,
  type CadEntity,
} from '../entities'

export const getCadEntitiesFromPage = (
  page: PaginaQuadernoNota,
): CadEntity[] => {
  const drawingEntities = page.disegni.map(
    segnoToCadEntity,
  )

  const imageEntities = (
    page.oggettiGrafici ?? []
  ).map(imageToCadEntity)

  const legacyEntities: CadEntity[] = [
    ...drawingEntities,
    ...imageEntities,
    ...(page.cadDimensions ?? []),
  ]

  const entitiesById = new Map<
    string,
    CadEntity
  >()

  for (const entity of legacyEntities) {
    entitiesById.set(entity.id, entity)
  }

  for (const entity of page.cadEntities ?? []) {
    entitiesById.set(entity.id, entity)
  }

  return Array.from(
    entitiesById.values(),
  )
}