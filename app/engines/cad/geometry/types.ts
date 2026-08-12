export type GeometryPoint = {
  x: number
  y: number
}

export type GeometryVector = {
  x: number
  y: number
}

export type GeometryBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type GeometryRect = GeometryBounds & {
  width: number
  height: number
}

export type GeometryCircle = {
  center: GeometryPoint
  radius: number
}
