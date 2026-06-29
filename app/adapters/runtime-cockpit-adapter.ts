import {
  CockpitSnapshot,
  createCockpitSnapshot,
} from '../view-models/cockpit-view-model'

export type RuntimeCockpitInput = {
  cantiereName?: string
  subtitle?: string
  focus?: string
  status?: string
}

export function createCockpitFromRuntime(
  runtime: RuntimeCockpitInput
): CockpitSnapshot {
  return createCockpitSnapshot({
  cantiereName: runtime.cantiereName,
  subtitle: runtime.subtitle,
  focus: runtime.focus,
  status: runtime.status,
})
}