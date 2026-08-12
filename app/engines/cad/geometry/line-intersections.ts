import { segmentIntersection } from "./intersections";
import type { GeometryPoint } from "./types";

export type GeometryIntersection = {  point: GeometryPoint;
  distance: number;
};

export function findLineIntersections(
  lineStart: GeometryPoint,
  lineEnd: GeometryPoint,
  others: {
    start: GeometryPoint;
    end: GeometryPoint;
  }[],
): GeometryIntersection[] {
  const result: GeometryIntersection[] = [];

  for (const other of others) {
    const point = segmentIntersection(
      lineStart,
      lineEnd,
      other.start,
      other.end,
    );

    if (!point) {
      continue;
    }

    result.push({
      point,
      distance: Math.hypot(
        point.x - lineStart.x,
        point.y - lineStart.y,
      ),
    });
  }

  result.sort(
    (a, b) => a.distance - b.distance,
  );

  return result;
}