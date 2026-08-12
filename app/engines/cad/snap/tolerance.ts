export const DEFAULT_SNAP_TOLERANCE_PX = 25

export const getSnapTolerance = (
  viewWidth: number,
  screenWidth: number,
): number => {
  if (
    !Number.isFinite(viewWidth) ||
    !Number.isFinite(screenWidth) ||
    viewWidth <= 0 ||
    screenWidth <= 0
  ) {
    return DEFAULT_SNAP_TOLERANCE_PX
  }

  return (
    DEFAULT_SNAP_TOLERANCE_PX *
    (viewWidth / screenWidth)
  )
}

