export type CadEntityId = string

export type CadLayerId = string

export type CadEntityType =
  | 'freehand'
  | 'line'
  | 'polyline'
  | 'rectangle'
  | 'circle'
  | 'text'
  | 'image'
  | 'dimension'
  | 'area'
  | 'symbol'
  | 'pin'

export type CadPoint = {
  x: number
  y: number
}

export type CadTransform = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
  scaleX: number
  scaleY: number
}

export type CadStrokeStyle = {
  color: string
  width: number
  opacity?: number
  dashArray?: number[]
}

export type CadFillStyle = {
  color: string
  opacity?: number
}

export type CadEntityMetadata = {
  title?: string
  description?: string
  category?: string
  status?: string

  sourceId?: string
  sourceType?: string

  computoCode?: string
  computoDescription?: string

  createdBy?: string

  [key: string]: unknown
}

export type CadEntityBase = {
  id: CadEntityId
  type: CadEntityType
  layerId: CadLayerId

  visible: boolean
  locked: boolean
  selectable: boolean

  createdAt: string
  updatedAt: string

  metadata?: CadEntityMetadata
}

export type CadFreehandEntity = CadEntityBase & {
  type: 'freehand'
  points: CadPoint[]
  stroke: CadStrokeStyle
}

export type CadLineEntity = CadEntityBase & {
  type: 'line'
  start: CadPoint
  end: CadPoint
  stroke: CadStrokeStyle
}

export type CadPolylineEntity = CadEntityBase & {
  type: 'polyline'
  points: CadPoint[]
  closed: boolean
  stroke: CadStrokeStyle
  fill?: CadFillStyle
}

export type CadRectangleEntity = CadEntityBase & {
  type: 'rectangle'
  transform: CadTransform
  stroke: CadStrokeStyle
  fill?: CadFillStyle
}

export type CadCircleEntity = CadEntityBase & {
  type: 'circle'
  center: CadPoint
  radius: number
  stroke: CadStrokeStyle
  fill?: CadFillStyle
}

export type CadTextAlignment =
  | 'left'
  | 'center'
  | 'right'

export type CadTextEntity = CadEntityBase & {
  type: 'text'
  position: CadPoint
  content: string

  fontSize: number
  fontFamily?: string
  fontWeight?: number | string

  color: string
  rotation: number
  alignment: CadTextAlignment
}

export type CadImageEntity = CadEntityBase & {
  type: 'image'
  source: string
  transform: CadTransform

  originalWidth?: number
  originalHeight?: number

  opacity?: number
}

export type CadDimensionKind =
  | 'linear'
  | 'aligned'
  | 'horizontal'
  | 'vertical'
  | 'angular'
  | 'radius'
  | 'diameter'

export type CadDimensionEntity = CadEntityBase & {
  type: 'dimension'
  kind: CadDimensionKind

  start: CadPoint
  end: CadPoint
  offset: number

  measuredValue?: number
  textOverride?: string
  unit?: string

  stroke: CadStrokeStyle
}

export type CadAreaEntity = CadEntityBase & {
  type: 'area'

  points: CadPoint[]

  areaSquareMeters: number
  perimeterMeters: number

  stroke: CadStrokeStyle
  fill?: CadFillStyle
}

export type CadSymbolEntity = CadEntityBase & {
  type: 'symbol'
  symbolId: string
  symbolCategory?: string

  transform: CadTransform

  properties?: Record<string, unknown>
}

export type CadPinEntity = CadEntityBase & {
  type: 'pin'
  position: CadPoint
  number: number

  title?: string
  description?: string

  status?:
    | 'new'
    | 'in_progress'
    | 'resolved'
}

export type CadEntity =
  | CadFreehandEntity
  | CadLineEntity
  | CadPolylineEntity
  | CadRectangleEntity
  | CadCircleEntity
  | CadTextEntity
  | CadImageEntity
  | CadDimensionEntity
  | CadAreaEntity
  | CadSymbolEntity
  | CadPinEntity

export type CadSelectionItem = {
  id: CadEntityId
  type: CadEntityType
}
