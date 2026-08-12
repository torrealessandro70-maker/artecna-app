import type {
  CadEntity,
  CadPoint,
  CadTransform,
} from "../entities/types"

export type CadBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const getPointsBounds = (
  points: CadPoint[],
): CadBounds => {
  if (points.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    }
  }

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)

  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

const getTransformBounds = (
  transform: CadTransform,
): CadBounds => ({
  minX: transform.x,
  minY: transform.y,
  maxX: transform.x + transform.width,
  maxY: transform.y + transform.height,
})

export const getCadEntityBounds = (
  entity: CadEntity,
): CadBounds => {
  switch (entity.type) {
    case "freehand":
    case "polyline":
case "area":
      return getPointsBounds(entity.points)

    case "line":
    case "dimension":
      return getPointsBounds([
        entity.start,
        entity.end,
      ])

    case "rectangle":
    case "image":
    case "symbol":
      return getTransformBounds(entity.transform)

    case "circle":
      return {
        minX: entity.center.x - entity.radius,
        minY: entity.center.y - entity.radius,
        maxX: entity.center.x + entity.radius,
        maxY: entity.center.y + entity.radius,
      }

    case "text":
    case "pin":
      return {
        minX:
          entity.type === "text"
            ? entity.position.x
            : entity.position.x,
        minY:
          entity.type === "text"
            ? entity.position.y
            : entity.position.y,
        maxX:
          entity.type === "text"
            ? entity.position.x
            : entity.position.x,
        maxY:
          entity.type === "text"
            ? entity.position.y
            : entity.position.y,
      }
  }
}
