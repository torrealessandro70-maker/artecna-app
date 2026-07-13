import { buildDocumentInsights } from './document-insights'
import { buildDocumentProfileFromText } from './document-profile'
import type {
  DocumentInsights,
  DocumentProfile,
} from './types'

export type DocumentIntelligencePipelineResult = {
  text: string
  profile: DocumentProfile
  insights: DocumentInsights
}

export const runDocumentIntelligencePipelineFromText = (
  text: string,
): DocumentIntelligencePipelineResult => {
  const profile = buildDocumentProfileFromText(text)
  const insights = buildDocumentInsights(profile)

  return {
    text,
    profile,
    insights,
  }
}