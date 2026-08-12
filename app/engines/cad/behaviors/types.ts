import type { CadEntity, CadEntityType } from '../entities'
import type { GeometryBounds, GeometryPoint } from '../geometry'

export interface CadEntityBehavior<
  TEntity extends CadEntity = CadEntity,
> {
  readonly type: CadEntityType

  getBounds(entity: TEntity): GeometryBounds

  getGripPoints?(entity: TEntity): GeometryPoint[]

  hitTest?(
    entity: TEntity,
    point: GeometryPoint,
    tolerance: number,
  ): boolean

  move?(
    entity: TEntity,
    dx: number,
    dy: number,
  ): TEntity

  rotate?(
    entity: TEntity,
    angle: number,
    origin?: GeometryPoint,
  ): TEntity

  scale?(
    entity: TEntity,
    factor: number,
    origin?: GeometryPoint,
  ): TEntity
}
