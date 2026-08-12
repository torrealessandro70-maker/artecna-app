import type {
  CadAreaPoint,
} from "./types";

export function createAreaPolylinePoints(
  points: CadAreaPoint[],
): string {
  return points
    .map((point) => `${point.x},${point.y}`)
    .join(" ");
}
