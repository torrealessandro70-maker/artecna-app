import type {
  CadCircleEntity,
  CadDimensionEntity,
  CadEntityBase,
  CadEntityMetadata,
  CadEntityType,
  CadFreehandEntity,
  CadImageEntity,
  CadLayerId,
  CadLineEntity,
  CadPinEntity,
  CadPoint,
  CadPolylineEntity,
  CadRectangleEntity,
  CadStrokeStyle,
  CadSymbolEntity,
  CadTextEntity,
  CadTransform,
} from './types'

type CadEntityBaseInput = {
  id?: string
  layerId?: CadLayerId
  visible?: boolean
  locked?: boolean
  selectable?: boolean
  metadata?: CadEntityMetadata
}

const createEntityId = () => crypto.randomUUID()

const createTimestamp = () => new Date().toISOString()

const createEntityBase = (
  type: CadEntityType,
  input: CadEntityBaseInput = {},
): CadEntityBase => {
  const timestamp = createTimestamp()

  return {
    id: input.id ?? createEntityId(),
    type,
    layerId: input.layerId ?? 'drawing',
    visible: input.visible ?? true,
    locked: input.locked ?? false,
    selectable: input.selectable ?? true,
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata: input.metadata,
  }
}

export type CreateCadLineInput =
  CadEntityBaseInput & {
    start: CadPoint
    end: CadPoint
    stroke: CadStrokeStyle
  }

export const createCadLine = (
  input: CreateCadLineInput,
): CadLineEntity => ({
  ...createEntityBase('line', input),
  type: 'line',
  start: input.start,
  end: input.end,
  stroke: input.stroke,
})

export type CreateCadFreehandInput =
  CadEntityBaseInput & {
    points: CadPoint[]
    stroke: CadStrokeStyle
  }

export const createCadFreehand = (
  input: CreateCadFreehandInput,
): CadFreehandEntity => ({
  ...createEntityBase('freehand', input),
  type: 'freehand',
  points: input.points,
  stroke: input.stroke,
})

export type CreateCadPolylineInput =
  CadEntityBaseInput & {
    points: CadPoint[]
    closed?: boolean
    stroke: CadStrokeStyle
  }

export const createCadPolyline = (
  input: CreateCadPolylineInput,
): CadPolylineEntity => ({
  ...createEntityBase('polyline', input),
  type: 'polyline',
  points: input.points,
  closed: input.closed ?? false,
  stroke: input.stroke,
})

export type CreateCadRectangleInput =
  CadEntityBaseInput & {
    transform: CadTransform
    stroke: CadStrokeStyle
  }

export const createCadRectangle = (
  input: CreateCadRectangleInput,
): CadRectangleEntity => ({
  ...createEntityBase('rectangle', input),
  type: 'rectangle',
  transform: input.transform,
  stroke: input.stroke,
})

export type CreateCadCircleInput =
  CadEntityBaseInput & {
    center: CadPoint
    radius: number
    stroke: CadStrokeStyle
  }

export const createCadCircle = (
  input: CreateCadCircleInput,
): CadCircleEntity => ({
  ...createEntityBase('circle', input),
  type: 'circle',
  center: input.center,
  radius: input.radius,
  stroke: input.stroke,
})

export type CreateCadTextInput =
  CadEntityBaseInput & {
    position: CadPoint
    content: string
    fontSize?: number
    color?: string
    rotation?: number
  }

export const createCadText = (
  input: CreateCadTextInput,
): CadTextEntity => ({
  ...createEntityBase('text', input),
  type: 'text',
  position: input.position,
  content: input.content,
  fontSize: input.fontSize ?? 16,
  color: input.color ?? '#111827',
  rotation: input.rotation ?? 0,
  alignment: 'left',
})

export type CreateCadImageInput =
  CadEntityBaseInput & {
    source: string
    transform: CadTransform
    originalWidth?: number
    originalHeight?: number
  }

export const createCadImage = (
  input: CreateCadImageInput,
): CadImageEntity => ({
  ...createEntityBase('image', {
    ...input,
    layerId: input.layerId ?? 'images',
  }),
  type: 'image',
  source: input.source,
  transform: input.transform,
  originalWidth: input.originalWidth,
  originalHeight: input.originalHeight,
  opacity: 1,
})

export type CreateCadDimensionInput =
  CadEntityBaseInput & {
    start: CadPoint
    end: CadPoint
    offset?: number
    stroke: CadStrokeStyle
  }

export const createCadDimension = (
  input: CreateCadDimensionInput,
): CadDimensionEntity => ({
  ...createEntityBase('dimension', input),
  type: 'dimension',
  kind: 'linear',
  start: input.start,
  end: input.end,
  offset: input.offset ?? 20,
  stroke: input.stroke,
})

export type CreateCadSymbolInput =
  CadEntityBaseInput & {
    symbolId: string
    symbolCategory?: string
    transform: CadTransform
  }

export const createCadSymbol = (
  input: CreateCadSymbolInput,
): CadSymbolEntity => ({
  ...createEntityBase('symbol', input),
  type: 'symbol',
  symbolId: input.symbolId,
  symbolCategory: input.symbolCategory,
  transform: input.transform,
})

export type CreateCadPinInput =
  CadEntityBaseInput & {
    position: CadPoint
    number: number
    title?: string
    description?: string
  }

export const createCadPin = (
  input: CreateCadPinInput,
): CadPinEntity => ({
  ...createEntityBase('pin', {
    ...input,
    layerId: input.layerId ?? 'pins',
  }),
  type: 'pin',
  position: input.position,
  number: input.number,
  title: input.title,
  description: input.description,
  status: 'new',
})
