export type BackgroundTransform = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  locked: boolean
}

export type ResizeHandle =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right'

