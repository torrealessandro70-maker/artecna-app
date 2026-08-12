import type { SnapCandidate, SnapPoint } from "./types";

export const distanceBetweenPoints = (
  firstPoint: SnapPoint,
  secondPoint: SnapPoint,
): number => {
  const deltaX = secondPoint.x - firstPoint.x;
  const deltaY = secondPoint.y - firstPoint.y;

  return Math.hypot(deltaX, deltaY);
};

export const midpointBetweenPoints = (
  firstPoint: SnapPoint,
  secondPoint: SnapPoint,
): SnapPoint => ({
  x: (firstPoint.x + secondPoint.x) / 2,
  y: (firstPoint.y + secondPoint.y) / 2,
});

export const isPointWithinTolerance = (
  pointer: SnapPoint,
  candidatePoint: SnapPoint,
  tolerance: number,
): boolean =>
  distanceBetweenPoints(pointer, candidatePoint) <= tolerance;

export const findNearestSnapCandidate = (
  candidates: SnapCandidate[],
  tolerance: number,
): SnapCandidate | null => {
  let nearestCandidate: SnapCandidate | null = null;

  for (const candidate of candidates) {
    if (candidate.distance > tolerance) {
      continue;
    }

    if (
      nearestCandidate === null ||
      candidate.distance < nearestCandidate.distance
    ) {
      nearestCandidate = candidate;
    }
  }

  return nearestCandidate;
};
