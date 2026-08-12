import type {
  CadEntityBehavior,
} from './types'

import type {
  CadEntityType,
} from '../entities'

const registry = new Map<
  CadEntityType,
  CadEntityBehavior
>()

export const registerBehavior = (
  behavior: CadEntityBehavior,
): void => {
  registry.set(behavior.type, behavior)
}

export const getBehavior = (
  type: CadEntityType,
): CadEntityBehavior | undefined =>
  registry.get(type)

export const hasBehavior = (
  type: CadEntityType,
): boolean =>
  registry.has(type)

export const getRegisteredBehaviorTypes =
  (): CadEntityType[] =>
    [...registry.keys()]

export const clearBehaviorRegistry =
  (): void => {
    registry.clear()
  }
