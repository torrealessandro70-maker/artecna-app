export type CadViewportPoint = {
  x: number;
  y: number;
};

export type CadViewportTransform = {
  scale: number;
  offset: CadViewportPoint;
};

export type CadViewportZoomOptions = {
  currentScale: number;
  nextScale: number;
  currentOffset: CadViewportPoint;
  anchorPoint: CadViewportPoint;
};

export function clampViewportScale(
  scale: number,
  minScale = 0.25,
  maxScale = 4,
): number {
  return Math.min(
    maxScale,
    Math.max(minScale, scale),
  );
}

export function calculateZoomAtPoint({
  currentScale,
  nextScale,
  currentOffset,
  anchorPoint,
}: CadViewportZoomOptions): CadViewportTransform {
  if (
    currentScale <= 0 ||
    nextScale <= 0 ||
    currentScale === nextScale
  ) {
    return {
      scale: currentScale,
      offset: currentOffset,
    };
  }

  const ratio =
    nextScale / currentScale;

  return {
    scale: nextScale,
    offset: {
      x:
        anchorPoint.x -
        (anchorPoint.x - currentOffset.x) *
          ratio,
      y:
        anchorPoint.y -
        (anchorPoint.y - currentOffset.y) *
          ratio,
    },
  };
}

export function calculateDistance(
  first: CadViewportPoint,
  second: CadViewportPoint,
): number {
  return Math.hypot(
    second.x - first.x,
    second.y - first.y,
  );
}

export function calculateCenterPoint(
  first: CadViewportPoint,
  second: CadViewportPoint,
): CadViewportPoint {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}