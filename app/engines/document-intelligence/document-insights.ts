import { resolveDocumentDestination } from './destination-resolver'
import type {
  DocumentInsights,
  DocumentProfile,
} from './types'

import { buildDocumentSuggestedActions } from './action-builder'

export const buildDocumentInsights = (
  profile: DocumentProfile,
): DocumentInsights => {
  const destination = resolveDocumentDestination(profile)

  const baseInsights = {
    profile,
    destination,

    client: undefined,

    supplier: undefined,

    amounts: {
      total: profile.total?.value,
    },

    itemsDetected: profile.hasItems ? 1 : 0,

    warnings: buildWarnings(profile),

    suggestions: buildSuggestions(profile),
  }

  return {
    ...baseInsights,
    actions: buildDocumentSuggestedActions(baseInsights),
  }
 }

const buildWarnings = (
  profile: DocumentProfile,
): string[] => {
  const warnings = [...profile.anomalies]

  if (!profile.total) {
    warnings.push('Totale documento da verificare manualmente')
  }

  if (profile.hasVat && !profile.total) {
    warnings.push('IVA presente ma totale non rilevato')
  }

  return warnings
}

const buildSuggestions = (
  profile: DocumentProfile,
): string[] => {
  const suggestions: string[] = []

  if (profile.kind === 'fattura') {
    suggestions.push('Valuta registrazione come fattura fornitore')
  }

  if (
    profile.kind === 'preventivo' ||
    profile.kind === 'computo'
  ) {
    suggestions.push('Valuta importazione nel Preventivo Engine')
  }

  if (profile.kind === 'sal') {
    suggestions.push('Valuta collegamento allo Stato Avanzamento Lavori')
  }

  if (profile.hasItems) {
    suggestions.push('Documento con possibili lavorazioni rilevate')
  }

  if (profile.hasVat) {
    suggestions.push('Verifica separazione tra imponibile e IVA')
  }

  return suggestions
}