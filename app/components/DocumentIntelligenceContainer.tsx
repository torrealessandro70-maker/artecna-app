import type { DocumentInsights } from '@/app/engines/document-intelligence'
import { DocumentInsightsCard } from './ui/DocumentInsightsCard'

type Props = {
  insights?: DocumentInsights
}

export function DocumentIntelligenceContainer({ insights }: Props) {
  if (!insights) {
    return null
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <DocumentInsightsCard insights={insights} />
    </div>
  )
}