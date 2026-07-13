import { buildDocumentInsights } from './document-insights'
import type { DocumentProfile } from './types'

export const runDocumentInsightsSmokeTest = () => {
  const profile: DocumentProfile = {
    kind: 'fattura',
    confidence: 0.85,

    total: {
      value: 1250,
      confidence: 0.95,
      method: 'keyword',
      sourceLine: 'Totale documento 1.250,00',
    },

    hasItems: false,
    hasUnitPrices: false,
    hasQuantities: false,
    hasVat: true,
    hasClient: true,
    hasSupplier: true,

    anomalies: [],
  }

  const insights = buildDocumentInsights(profile)

  return {
    success:
      insights.amounts.total === 1250 &&
      insights.warnings.length === 0 &&
      insights.suggestions.includes(
        'Valuta registrazione come fattura fornitore',
      ) &&
      insights.suggestions.includes(
        'Verifica separazione tra imponibile e IVA',
      ),

    insights,
  }
}