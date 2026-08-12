import type {
  CadCircleEntity,
  CadDimensionEntity,
  CadEntity,
  CadFreehandEntity,
  CadImageEntity,
  CadLineEntity,
  CadPinEntity,
  CadPolylineEntity,
  CadRectangleEntity,
  CadSymbolEntity,
  CadTextEntity,
} from './types'

export const isCadFreehandEntity = (
  entity: CadEntity,
): entity is CadFreehandEntity =>
  entity.type === 'freehand'

export const isCadLineEntity = (
  entity: CadEntity,
): entity is CadLineEntity =>
  entity.type === 'line'

export const isCadPolylineEntity = (
  entity: CadEntity,
): entity is CadPolylineEntity =>
  entity.type === 'polyline'

export const isCadRectangleEntity = (
  entity: CadEntity,
): entity is CadRectangleEntity =>
  entity.type === 'rectangle'

export const isCadCircleEntity = (
  entity: CadEntity,
): entity is CadCircleEntity =>
  entity.type === 'circle'

export const isCadTextEntity = (
  entity: CadEntity,
): entity is CadTextEntity =>
  entity.type === 'text'

export const isCadImageEntity = (
  entity: CadEntity,
): entity is CadImageEntity =>
  entity.type === 'image'

export const isCadDimensionEntity = (
  entity: CadEntity,
): entity is CadDimensionEntity =>
  entity.type === 'dimension'

export const isCadSymbolEntity = (
  entity: CadEntity,
): entity is CadSymbolEntity =>
  entity.type === 'symbol'

export const isCadPinEntity = (
  entity: CadEntity,
): entity is CadPinEntity =>
  entity.type === 'pin'
