export type CadPoint = {
  x: number
  y: number
}

export const applyOrtho = (
  start: CadPoint,
  current: CadPoint,
): CadPoint => {
  const dx = current.x - start.x
  const dy = current.y - start.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: current.x,
      y: start.y,
    }
  }

  return {
    x: start.x,
    y: current.y,
  }
}
