import type { RuntimeFeedItem } from '@/app/runtime/feed'

export type CockpitSituationLevel = 'stable' | 'attention' | 'critical'

export interface CockpitSummary {
  level: CockpitSituationLevel
  title: string
  situation: string
  recentFacts: string[]
  attention: string[]
  suggestions: string[]
  nextAction: string
  generatedAt: string
  sourceEventCount: number
}

export interface CockpitSummaryInput {
  feedItems: RuntimeFeedItem[]
}
