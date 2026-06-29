import {
  CockpitSnapshot,
  createCockpitSnapshot,
} from '../view-models/cockpit-view-model'

export type RuntimeCockpitInput = {
  cantiereName?: string
  focus?: string
  status?: string
}

export function createCockpitFromRuntime(
  runtime: RuntimeCockpitInput
): CockpitSnapshot {
  return createCockpitSnapshot({
    cantiereName: runtime.cantiereName,
    focus: runtime.focus,
    status: runtime.status,
  })
}