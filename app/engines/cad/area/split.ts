import {
  segmentIntersection,
} from "../geometry"

import type {
  CadAreaPoint,
} from "./types"

import type {
  CadAreaEntity,
} from "../entities"

import type {
  CadScaleCalibration,
} from "../scale-manager"

import {
  calculateAreaMetrics,
} from "./geometry"

export type SplitAreaResult = {
  first: CadAreaPoint[]
  second: CadAreaPoint[]
}

type AreaEdgeIntersection = {
  point: CadAreaPoint
  edgeIndex: number
}

const puntiUguali = (
  a: CadAreaPoint,
  b: CadAreaPoint,
  tolerance = 0.000001,
) =>
  Math.hypot(
    a.x - b.x,
    a.y - b.y,
  ) <= tolerance

export function splitAreaByLine(
  points: CadAreaPoint[],
  lineStart: CadAreaPoint,
  lineEnd: CadAreaPoint,
): SplitAreaResult | null {
  if (points.length < 3) {
    return null
  }



  const intersezioni: AreaEdgeIntersection[] =
    []

  for (
    let index = 0;
    index < points.length;
    index++
  ) {
    const edgeStart =
      points[index]

    const edgeEnd =
      points[
        (index + 1) % points.length
      ]

    const intersection =
      segmentIntersection(
        edgeStart,
        edgeEnd,
        lineStart,
        lineEnd,
      )

    if (!intersection) {
      continue
    }

    const duplicata =
      intersezioni.some(
        (item) =>
          puntiUguali(
            item.point,
            intersection,
          ),
      )

    if (duplicata) {
      continue
    }

    intersezioni.push({
      point: intersection,
      edgeIndex: index,
    })
  }

console.log("AREA SPLIT GEOMETRY", {
  areaPoints: points,
  lineStart,
  lineEnd,
  intersectionsCount: intersezioni.length,
  intersections: intersezioni,
})

  if (intersezioni.length !== 2) {
    return null
  }

  const [prima, seconda] =
    intersezioni.sort(
      (a, b) =>
        a.edgeIndex - b.edgeIndex,
    )

  const first: CadAreaPoint[] = [
    prima.point,
  ]

  let index =
    (prima.edgeIndex + 1) %
    points.length

  while (
    index !==
    (seconda.edgeIndex + 1) %
      points.length
  ) {
    first.push(points[index])

    index =
      (index + 1) %
      points.length
  }

  first.push(seconda.point)

  const second: CadAreaPoint[] = [
    seconda.point,
  ]

  index =
    (seconda.edgeIndex + 1) %
    points.length

  while (
    index !==
    (prima.edgeIndex + 1) %
      points.length
  ) {
    second.push(points[index])

    index =
      (index + 1) %
      points.length
  }

  second.push(prima.point)

  if (
    first.length < 3 ||
    second.length < 3
  ) {
    return null
  }

  return {
    first,
    second,
  }
}

export type SplitCadAreaEntityResult = {
  first: CadAreaEntity
  second: CadAreaEntity
}

export function splitCadAreaEntityByLine(
  entity: CadAreaEntity,
  lineStart: CadAreaPoint,
  lineEnd: CadAreaPoint,
  scaleCalibration: CadScaleCalibration | null,
  sourceLineId?: string,
): SplitCadAreaEntityResult | null {

  const splitResult =
    splitAreaByLine(
      entity.points,
      lineStart,
      lineEnd,
    )

  if (!splitResult) {
    return null
  }

  const firstMetrics =
    calculateAreaMetrics(
      splitResult.first,
      scaleCalibration,
    )

  const secondMetrics =
    calculateAreaMetrics(
      splitResult.second,
      scaleCalibration,
    )

  const now =
    new Date().toISOString()

  const first: CadAreaEntity = {
  ...entity,

  id: crypto.randomUUID(),

  createdAt: now,
  updatedAt: now,

  metadata: {
    ...entity.metadata,
    splitSourceAreaId: entity.id,
    splitSourceLineId: sourceLineId,
    splitOriginalPoints: entity.points.map(
      (point) => ({
        x: point.x,
        y: point.y,
      }),
    ),
  },

  points:
    splitResult.first.map(
      (point) => ({
        x: point.x,
        y: point.y,
      }),
    ),

  areaSquareMeters:
    firstMetrics.areaSquareMeters,

  perimeterMeters:
    firstMetrics.perimeterMeters,
}

  const second: CadAreaEntity = {
  ...entity,

  id: crypto.randomUUID(),

  createdAt: now,
  updatedAt: now,

  metadata: {
    ...entity.metadata,
    splitSourceAreaId: entity.id,
    splitSourceLineId: sourceLineId,
    splitOriginalPoints: entity.points.map(
      (point) => ({
        x: point.x,
        y: point.y,
      }),
    ),
  },

  points:
    splitResult.second.map(
      (point) => ({
        x: point.x,
        y: point.y,
      }),
    ),

  areaSquareMeters:
    secondMetrics.areaSquareMeters,

  perimeterMeters:
    secondMetrics.perimeterMeters,
}

  return {
    first,
    second,
  }
}