import type {
  CadEntity,
  CadEntityId,
} from '../entities'

import type {
  GeometryPoint,
} from '../geometry'

export type SnapType =
  | 'endpoint'
  | 'midpoint'
  | 'intersection'
  | 'center'
  | 'grid'
  | 'perpendicular'

export interface SnapPoint extends GeometryPoint {
  type: SnapType
  priority: number
  entityId?: CadEntityId
  relatedEntityIds?: CadEntityId[]
}

export interface SnapResolveOptions {
  entities: CadEntity[]
  cursor: GeometryPoint
  tolerance: number
  enabledTypes?: SnapType[]
}

export interface SnapProviderContext {
  entities: CadEntity[]
}

export type SnapProvider = (
  entity: CadEntity,
  context: SnapProviderContext,
) => SnapPoint[]