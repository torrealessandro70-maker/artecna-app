import type { BackgroundTransform } from './types'

export const createDefaultBackgroundTransform = (
  width = 900,
  height = 520,
): BackgroundTransform => ({
  x: 0,
  y: 0,
  width,
  height,
  rotation: 0,
  locked: false,
})

export const normalizeBackgroundTransform = (
  transform?: Partial<BackgroundTransform> | null,
  defaultWidth = 900,
  defaultHeight = 520,
): BackgroundTransform => ({
  x: Number(transform?.x ?? 0),
  y: Number(transform?.y ?? 0),
  width: Math.max(40, Number(transform?.width ?? defaultWidth)),
  height: Math.max(40, Number(transform?.height ?? defaultHeight)),
  rotation: Number(transform?.rotation ?? 0),
  locked: Boolean(transform?.locked ?? false),
})
