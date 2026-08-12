export type CadPoint = {
  x: number;
  y: number;
};

const EPSILON = 0.000001;

export function segmentIntersection(
  a1: CadPoint,
  a2: CadPoint,
  b1: CadPoint,
  b2: CadPoint,
): CadPoint | null {
  const denominator =
    (a1.x - a2.x) * (b1.y - b2.y) -
    (a1.y - a2.y) * (b1.x - b2.x);

  if (Math.abs(denominator) < EPSILON) {
    return null;
  }

  const t =
    (
      (a1.x - b1.x) * (b1.y - b2.y) -
      (a1.y - b1.y) * (b1.x - b2.x)
    ) / denominator;

  const u =
    (
      (a1.x - b1.x) * (a1.y - a2.y) -
      (a1.y - b1.y) * (a1.x - a2.x)
    ) / denominator;

  if (
    t < 0 ||
    t > 1 ||
    u < 0 ||
    u > 1
  ) {
    return null;
  }

  return {
    x: a1.x + t * (a2.x - a1.x),
    y: a1.y + t * (a2.y - a1.y),
  };
}