import type { DocumentProfile } from './types'

export type DocumentDestinationKey =
  | 'preventivo_ufficiale'
  | 'preventivo_ai'
  | 'fattura_fornitore'
  | 'sal'
  | 'materiali'
  | 'attrezzi'
  | 'archivio_fascicolo'

export type ResolvedDocumentDestination = {
  suggested: DocumentDestinationKey
  confidence: number
  alternatives: DocumentDestinationKey[]
  reasons: string[]
}

export const resolveDocumentDestination = (
  profile: DocumentProfile,
): ResolvedDocumentDestination => {
  if (profile.kind === 'fattura') {
    return {
      suggested: 'fattura_fornitore',
      confidence: 0.9,
      alternatives: ['archivio_fascicolo'],
      reasons: ['Documento classificato come fattura'],
    }
  }

  if (profile.kind === 'sal') {
    return {
      suggested: 'sal',
      confidence: 0.9,
      alternatives: ['archivio_fascicolo'],
      reasons: ['Documento classificato come SAL'],
    }
  }

  if (profile.kind === 'computo') {
    return {
      suggested: 'preventivo_ai',
      confidence: 0.85,
      alternatives: ['preventivo_ufficiale', 'archivio_fascicolo'],
      reasons: ['Computo con possibili lavorazioni'],
    }
  }

  if (profile.kind === 'preventivo') {
    return {
      suggested: 'preventivo_ufficiale',
      confidence: 0.85,
      alternatives: ['preventivo_ai', 'archivio_fascicolo'],
      reasons: ['Documento classificato come preventivo'],
    }
  }

  return {
    suggested: 'archivio_fascicolo',
    confidence: 0.5,
    alternatives: [],
    reasons: ['Destinazione prudente per documento non riconosciuto'],
  }
}