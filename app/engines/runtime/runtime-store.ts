import type { RuntimeSnapshot, RuntimeState } from './index'

let currentRuntime: RuntimeSnapshot = {
  state: 'created',
  updatedAt: new Date().toISOString(),
}

export function getRuntimeState(): RuntimeSnapshot {
  return currentRuntime
}

export function updateRuntimeState(
  state: RuntimeState
): RuntimeSnapshot {
  currentRuntime = {
    state,
    updatedAt: new Date().toISOString(),
  }

  return currentRuntime
}