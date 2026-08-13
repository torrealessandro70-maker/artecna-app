import type {
  CadAreaEntity,
} from "../entities"

import type {
  CadScaleCalibration,
} from "../scale-manager"

import {
  calculateAreaMetrics,
  mergeAreaPointsBySharedEdge,
} from "./geometry"

export function mergeCadAreaEntities(
  first: CadAreaEntity,
  second: CadAreaEntity,
  scaleCalibration: CadScaleCalibration | null,
): CadAreaEntity | null {
  const mergedPoints =
    mergeAreaPointsBySharedEdge(
      first.points,
      second.points,
    )

  if (!mergedPoints) {
    return null
  }

  const metrics =
    calculateAreaMetrics(
      mergedPoints,
      scaleCalibration,
    )

  const now =
    new Date().toISOString()

  return {
    ...first,

    id: crypto.randomUUID(),

    createdAt: now,
    updatedAt: now,

    points: mergedPoints,

    areaSquareMeters:
      metrics.areaSquareMeters,

    perimeterMeters:
      metrics.perimeterMeters,

    metadata: {
      ...first.metadata,
      mergedFromAreaIds: [
        first.id,
        second.id,
      ],
    },
  }
}
export * from "./merge"