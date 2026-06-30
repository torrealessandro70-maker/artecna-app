import { buildCockpitSummary } from '@/app/engines/cockpit-intelligence'
import { createDemoRuntimeFeed, type RuntimeFeedItem } from '../runtime/feed'
import {
  CockpitSnapshot,
  createCockpitSnapshot,
} from '../view-models/cockpit-view-model'

export type RuntimeCockpitInput = {
  cantiereName?: string
  subtitle?: string
  focus?: string
  status?: string
  feed?: RuntimeFeedItem[]
}

export function createCockpitFromRuntime(
  runtime: RuntimeCockpitInput
): CockpitSnapshot {
  const feed = runtime.feed || createDemoRuntimeFeed()
  const cockpitSummary = buildCockpitSummary({ feedItems: feed })

  return createCockpitSnapshot({
    cantiereName: runtime.cantiereName,
    subtitle: runtime.subtitle,
    focus: runtime.focus,
    status: runtime.status,
    feed,
    cockpitSummary,
  })
}
