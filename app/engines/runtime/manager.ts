import type { RuntimeState } from './state'

export type RuntimeSnapshot = {
  state: RuntimeState
  updatedAt: string
}

export function createRuntimeState(
  state: RuntimeState
): RuntimeSnapshot {
  return {
    state,
    updatedAt: new Date().toISOString(),
  }
}