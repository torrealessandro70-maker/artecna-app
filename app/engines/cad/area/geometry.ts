import type {
  CadScaleCalibration,
} from "../scale-manager";

import type {
  CadAreaPoint,
} from "./types";

export type CadAreaMetrics = {
  areaSquareMeters: number;
  perimeterMeters: number;
};

export function addAreaPoint(
  points: CadAreaPoint[],
  point: CadAreaPoint,
): CadAreaPoint[] {
  return [...points, point];
}

export function isNearAreaPoint(
  point: CadAreaPoint,
  target: CadAreaPoint,
  tolerance = 12,
): boolean {
  const deltaX = point.x - target.x;
  const deltaY = point.y - target.y;

  return Math.hypot(deltaX, deltaY) <= tolerance;
}

export function calculateArea(
  points: CadAreaPoint[],
): number {
  if (points.length < 3) {
    return 0;
  }

  let doubleArea = 0;

  for (
    let index = 0;
    index < points.length;
    index += 1
  ) {
    const currentPoint = points[index];
    const nextPoint =
      points[(index + 1) % points.length];

    doubleArea +=
      currentPoint.x * nextPoint.y -
      nextPoint.x * currentPoint.y;
  }

  return Math.abs(doubleArea) / 2;
}

export function calculatePerimeter(
  points: CadAreaPoint[],
): number {
  if (points.length < 2) {
    return 0;
  }

  let perimeter = 0;

  for (
    let index = 0;
    index < points.length;
    index += 1
  ) {
    const currentPoint = points[index];
    const nextPoint =
      points[(index + 1) % points.length];

    perimeter += Math.hypot(
      nextPoint.x - currentPoint.x,
      nextPoint.y - currentPoint.y,
    );
  }

  return perimeter;
}

function convertRealDistanceToMeters(
  realDistance: number,
  unit: CadScaleCalibration["unit"],
): number {
  switch (unit) {
    case "mm":
      return realDistance / 1000;

    case "cm":
      return realDistance / 100;

    case "m":
      return realDistance;
  }
}

export function calculateAreaMetrics(
  points: CadAreaPoint[],
  scaleCalibration: CadScaleCalibration | null,
): CadAreaMetrics {
  if (!scaleCalibration) {
    return {
      areaSquareMeters: 0,
      perimeterMeters: 0,
    };
  }

  if (
    scaleCalibration.pixelDistance <= 0 ||
    scaleCalibration.realDistance <= 0
  ) {
    return {
      areaSquareMeters: 0,
      perimeterMeters: 0,
    };
  }

  const realDistanceMeters =
    convertRealDistanceToMeters(
      scaleCalibration.realDistance,
      scaleCalibration.unit,
    );

  const metersPerPixel =
    realDistanceMeters /
    scaleCalibration.pixelDistance;

  const areaSquarePixels =
    calculateArea(points);

  const perimeterPixels =
    calculatePerimeter(points);

  return {
    areaSquareMeters:
      areaSquarePixels *
      metersPerPixel *
      metersPerPixel,

    perimeterMeters:
      perimeterPixels *
      metersPerPixel,
  };
}

export type NearestAreaBoundaryPoint = {
  point: CadAreaPoint
  edgeIndex: number
  distance: number
}

export function findNearestAreaBoundaryPoint(
  points: CadAreaPoint[],
  target: CadAreaPoint,
): NearestAreaBoundaryPoint | null {
  if (points.length < 2) {
    return null
  }

  let risultato:
    | NearestAreaBoundaryPoint
    | null = null

  for (
    let index = 0;
    index < points.length;
    index++
  ) {
    const start = points[index]

    const end =
      points[
        (index + 1) %
          points.length
      ]

    const dx = end.x - start.x
    const dy = end.y - start.y

    const lunghezzaQuadrata =
      dx * dx + dy * dy

    if (lunghezzaQuadrata === 0) {
      continue
    }

    const t = Math.max(
      0,
      Math.min(
        1,
        (
          (target.x - start.x) * dx +
          (target.y - start.y) * dy
        ) / lunghezzaQuadrata,
      ),
    )

    const point = {
      x: start.x + t * dx,
      y: start.y + t * dy,
    }

    const distance =
      Math.hypot(
        target.x - point.x,
        target.y - point.y,
      )

    if (
      !risultato ||
      distance < risultato.distance
    ) {
      risultato = {
        point,
        edgeIndex: index,
        distance,
      }
    }
  }

  return risultato
}
export type SharedAreaEdge = {
  firstEdgeIndex: number
  secondEdgeIndex: number
  start: CadAreaPoint
  end: CadAreaPoint
}

export function findSharedAreaEdge(
  firstPoints: CadAreaPoint[],
  secondPoints: CadAreaPoint[],
  tolerance = 0.000001,
): SharedAreaEdge | null {
  const puntiUguali = (
    a: CadAreaPoint,
    b: CadAreaPoint,
  ) =>
    Math.hypot(
      a.x - b.x,
      a.y - b.y,
    ) <= tolerance

  for (
    let firstIndex = 0;
    firstIndex < firstPoints.length;
    firstIndex++
  ) {
    const firstStart =
      firstPoints[firstIndex]

    const firstEnd =
      firstPoints[
        (firstIndex + 1) %
          firstPoints.length
      ]

    for (
      let secondIndex = 0;
      secondIndex < secondPoints.length;
      secondIndex++
    ) {
      const secondStart =
        secondPoints[secondIndex]

      const secondEnd =
        secondPoints[
          (secondIndex + 1) %
            secondPoints.length
        ]

      const stessoVerso =
        puntiUguali(
          firstStart,
          secondStart,
        ) &&
        puntiUguali(
          firstEnd,
          secondEnd,
        )

      const versoOpposto =
        puntiUguali(
          firstStart,
          secondEnd,
        ) &&
        puntiUguali(
          firstEnd,
          secondStart,
        )

      if (
        stessoVerso ||
        versoOpposto
      ) {
        return {
          firstEdgeIndex: firstIndex,
          secondEdgeIndex: secondIndex,
          start: {
            x: firstStart.x,
            y: firstStart.y,
          },
          end: {
            x: firstEnd.x,
            y: firstEnd.y,
          },
        }
      }
    }
  }

  return null
}
export function mergeAreaPointsBySharedEdge(
  firstPoints: CadAreaPoint[],
  secondPoints: CadAreaPoint[],
): CadAreaPoint[] | null {
  const sharedEdge =
    findSharedAreaEdge(
      firstPoints,
      secondPoints,
    )

  if (!sharedEdge) {
    return null
  }

  const buildPathWithoutEdge = (
    points: CadAreaPoint[],
    edgeIndex: number,
  ): CadAreaPoint[] => {
    const result: CadAreaPoint[] = []

    let index =
      (edgeIndex + 1) %
      points.length

    result.push({
      x: points[index].x,
      y: points[index].y,
    })

    while (
      index !== edgeIndex
    ) {
      index =
        (index + 1) %
        points.length

      result.push({
        x: points[index].x,
        y: points[index].y,
      })
    }

    return result
  }

  const firstPath =
    buildPathWithoutEdge(
      firstPoints,
      sharedEdge.firstEdgeIndex,
    )

  let secondPath =
    buildPathWithoutEdge(
      secondPoints,
      sharedEdge.secondEdgeIndex,
    )

  if (
    firstPath.length < 2 ||
    secondPath.length < 2
  ) {
    return null
  }

  const puntiUguali = (
    a: CadAreaPoint,
    b: CadAreaPoint,
  ) =>
    Math.hypot(
      a.x - b.x,
      a.y - b.y,
    ) <= 0.000001

  if (
    !puntiUguali(
      firstPath[
        firstPath.length - 1
      ],
      secondPath[0],
    ) ||
    !puntiUguali(
      firstPath[0],
      secondPath[
        secondPath.length - 1
      ],
    )
  ) {
    secondPath = [
      ...secondPath,
    ].reverse()
  }

  if (
    !puntiUguali(
      firstPath[
        firstPath.length - 1
      ],
      secondPath[0],
    ) ||
    !puntiUguali(
      firstPath[0],
      secondPath[
        secondPath.length - 1
      ],
    )
  ) {
    return null
  }

  return [
    ...firstPath,
    ...secondPath.slice(
      1,
      secondPath.length - 1,
    ),
  ]
}
