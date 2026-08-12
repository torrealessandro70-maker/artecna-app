export type CadPoint = {
  x: number
  y: number
}

export type CadScale = {
  pixelDistance: number
  realDistance: number
  unit: 'mm' | 'cm' | 'm'
}

export const calculatePixelDistance = (
  start: CadPoint,
  end: CadPoint,
): number => {
  return Math.hypot(
    end.x - start.x,
    end.y - start.y,
  )
}

export const pixelsToReal = (
  pixels: number,
  scale: CadScale,
): number => {
  if (
    scale.pixelDistance <= 0
  ) {
    return 0
  }

  return (
    pixels *
    scale.realDistance /
    scale.pixelDistance
  )
}

export const realToPixels = (
  value: number,
  scale: CadScale,
): number => {
  if (
    scale.realDistance <= 0
  ) {
    return 0
  }

  return (
    value *
    scale.pixelDistance /
    scale.realDistance
  )
}
