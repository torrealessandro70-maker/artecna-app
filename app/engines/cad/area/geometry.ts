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