import { classifyDocument } from './document-classifier'
import type { DocumentKind } from './document-classifier'
import { extractDocumentTotalDetailed } from './total-extractor'
import type {
  DocumentAnalysisResult,
  DocumentProfile,
  DocumentType,
} from './types'

const mapDocumentKindToDocumentType = (
  kind: DocumentKind,
): DocumentType => {
  if (kind === 'capitolato') return 'documento_tecnico'
  if (kind === 'offerta') return 'preventivo'
  if (kind === 'prezzario') return 'documento_tecnico'
  if (kind === 'sconosciuto') return 'altro'

  return kind
}

const mapTotalConfidence = (
  confidence: 'high' | 'medium' | 'low' | 'none',
): number => {
  if (confidence === 'high') return 0.95
  if (confidence === 'medium') return 0.75
  if (confidence === 'low') return 0.45

  return 0
}

export const buildDocumentProfileFromText = (
  text: string,
): DocumentProfile => {
  const kind = classifyDocument(text)
  const total = extractDocumentTotalDetailed(text, kind)

  return {
    kind: mapDocumentKindToDocumentType(kind),
    confidence: kind === 'sconosciuto' ? 0.15 : 0.85,

    total:
      total.value > 0
        ? {
            value: total.value,
            confidence: mapTotalConfidence(total.confidence),
            method: total.method,
            sourceLine: total.sourceLine,
          }
        : undefined,

    hasItems: containsAny(text, [
      'descrizione',
      'lavorazione',
      'voce',
      'articolo',
      'computo',
    ]),
    hasUnitPrices: containsAny(text, [
      'prezzo unitario',
      'prezzo_unitario',
      'p.u.',
      'pu',
      'EUR/mq',
      'EUR/m2',
      'euro/mq',
    ]),
    hasQuantities: containsAny(text, [
      'quantita',
      'q.ta',
      'qta',
      'mq',
      'm2',
      'ml',
      'mc',
    ]),
    hasVat: containsAny(text, [
      'iva',
      'i.v.a.',
      'imposta',
    ]),
    hasClient: containsAny(text, [
      'cliente',
      'committente',
      'spett.le',
      'destinatario',
    ]),
    hasSupplier: containsAny(text, [
      'fornitore',
      'impresa',
      'ditta',
      'emittente',
      'cedente',
    ]),

    anomalies: total.value > 0 ? [] : ['Totale documento non rilevato'],
  }
}

export const buildDocumentProfile = (
  analysis: DocumentAnalysisResult,
): DocumentProfile => {
  if (analysis.extractedText) {
    return buildDocumentProfileFromText(analysis.extractedText)
  }

  return {
    kind: analysis.classification.type,
    confidence: analysis.classification.confidence,

    total: undefined,

    hasItems: analysis.rows.length > 0,
    hasUnitPrices: false,
    hasQuantities: false,
    hasVat: false,
    hasClient: false,
    hasSupplier: false,

    anomalies: ['Testo documento non disponibile'],
  }
}

const containsAny = (
  text: string,
  keywords: string[],
) => {
  const normalized = text.toLowerCase()

  return keywords.some((keyword) =>
    normalized.includes(keyword.toLowerCase()),
  )
}