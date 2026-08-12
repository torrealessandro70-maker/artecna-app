import type { CadPoint } from './scale'

export type CadScaleCalibration = {
  start: CadPoint
  end: CadPoint
  pixelDistance: number
  realDistance: number
  unit: 'mm' | 'cm' | 'm'
}

export const createScaleCalibration = (
  start: CadPoint,
  end: CadPoint,
  realDistance: number,
  unit: CadScaleCalibration['unit'],
): CadScaleCalibration => {
  const pixelDistance = Math.hypot(
    end.x - start.x,
    end.y - start.y,
  )

  return {
    start,
    end,
    pixelDistance,
    realDistance,
    unit,
  }
}
