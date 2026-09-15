import { classifyDocument } from './document-classifier'
import { extractOfferAmounts, type OfferAmounts } from './offer-amounts'
import type { DocumentKind } from './document-classifier'
type TotalCandidate = {
  label: string
  value: number
  score: number
  line: string
}

const parseItalianMoney = (value: string): number => {
  const cleaned = value
    .replace(/\s/g, '')
    .replace(/€/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  const parsed = Number(cleaned)

  return Number.isFinite(parsed) ? parsed : 0
}

const extractMoneyValues = (line: string): number[] => {
  const matches =
    line.match(/(?:€\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}/g) || []

  return matches
    .map(parseItalianMoney)
    .filter((value) => value > 0)
}

const scoreLine = (line: string): number => {
  const text = line.toLowerCase()

  let score = 0

  if (text.includes('totale generale')) score += 100
  if (text.includes('importo complessivo')) score += 95
  if (text.includes('totale offerta')) score += 95
  if (text.includes('totale lavori')) score += 90
  if (text.includes('importo lavori')) score += 85
  if (text.includes('importo computo')) score += 85
  if (text.includes('totale lavorazioni')) score += 80
  if (text.includes('totale opere')) score += 80
  if (text.includes('totale iva esclusa')) score += 78
  if (text.includes('totale imponibile')) score += 75
  if (text.includes('importo netto')) score += 70
  if (text.includes('base d\'asta')) score += 70
  if (text.includes('totale documento')) score += 65
  if (text.includes('totale fattura')) score += 65
  if (text.includes('totale da pagare')) score += 65

  if (text.includes('iva inclusa')) score -= 10
  if (text.includes('iva')) score -= 5
  if (text.includes('acconto')) score -= 20
  if (text.includes('saldo')) score -= 15
  if (text.includes('ritenuta')) score -= 30
  if (text.includes('imposta')) score -= 20

  if (text.includes('totale')) score += 25
  if (text.includes('importo')) score += 20

  return score
}

export const extractDocumentTotal = (text: string): number => {
  const kind = classifyDocument(text)
  if (kind === 'offerta' || kind === 'preventivo') return extractDocumentTotalDetailed(text, kind).value
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const candidates: TotalCandidate[] = []

  lines.forEach((line) => {
    const values = extractMoneyValues(line)
    if (values.length === 0) return

    const score = scoreLine(line)
    if (score <= 0) return

    const value = values[values.length - 1]

    candidates.push({
      label: 'document-total',
      value,
      score,
      line,
    })
  })

  const best = candidates.sort((a, b) => b.score - a.score || b.value - a.value)[0]

   if (best) return Number(best.value.toFixed(2))

  const fallbackValues = lines
    .filter((line) => {
      const text = line.toLowerCase()

      return (
        !text.includes('iva') &&
        !text.includes('imposta') &&
        !text.includes('ritenuta') &&
        !text.includes('acconto') &&
        !text.includes('saldo')
      )
    })
    .flatMap(extractMoneyValues)

  const fallback = fallbackValues.length > 0 ? Math.max(...fallbackValues) : 0

  return Number(fallback.toFixed(2))
}
export type ExtractDocumentTotalResult = {
  amounts?: OfferAmounts
  value: number
  confidence: 'high' | 'medium' | 'low' | 'none'
  sourceLine?: string
  method: 'keyword' | 'fallback' | 'none'
}

export const extractDocumentTotalDetailed = (
  text: string,
  documentKind: DocumentKind = 'sconosciuto',
  itemsTotal?: number,
): ExtractDocumentTotalResult => {
  const kind = documentKind === 'sconosciuto' ? classifyDocument(text) : documentKind
  if (kind === 'offerta' || kind === 'preventivo') {
    const amounts = extractOfferAmounts(text, itemsTotal)
    // Retain the existing label ranking. Payments and VAT are never candidates.
    const candidates = [amounts.imponibile, amounts.totaleDocumento].filter((entry) => entry !== undefined)
      .map((entry) => ({ ...entry, score: scoreLine(entry.label) + (kind === 'offerta'
        ? (entry.label.toLowerCase().includes('totale offerta') ? 40 : 0) + (entry.label.toLowerCase().includes('totale iva esclusa') ? 35 : 0) : 0) }))
      .sort((a, b) => b.score - a.score || b.value - a.value)
    const best = candidates[0]
    return best ? { value: best.value, confidence: best.score >= 90 ? 'high' : best.score >= 65 ? 'medium' : 'low',
      sourceLine: `${best.label}: ${best.value.toFixed(2)}${best.evidence ? ` (${best.evidence})` : ''}`, method: 'keyword', amounts }
      : { value: 0, confidence: 'none', method: 'none', amounts }
  }
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const candidates: TotalCandidate[] = []

  lines.forEach((line) => {
    const values = extractMoneyValues(line)
    if (values.length === 0) return

    let score = scoreLine(line)

const normalizedLine = line.toLowerCase()

if (documentKind === 'computo') {
  if (normalizedLine.includes('totale lavori')) score += 40
  if (normalizedLine.includes('importo lavori')) score += 40
  if (normalizedLine.includes('importo computo')) score += 35
}

if (documentKind === 'fattura') {
  if (normalizedLine.includes('totale documento')) score += 40
  if (normalizedLine.includes('totale da pagare')) score += 40
  if (normalizedLine.includes('totale fattura')) score += 35
}

if (documentKind === 'offerta') {
  if (normalizedLine.includes('totale offerta')) score += 40
  if (normalizedLine.includes('totale iva esclusa')) score += 35
}

if (documentKind === 'sal') {
  if (normalizedLine.includes('importo sal')) score += 40
  if (normalizedLine.includes('stato avanzamento lavori')) score += 35
}
    if (score <= 0) return

    const value = values[values.length - 1]

    candidates.push({
      label: 'document-total',
      value,
      score,
      line,
    })
  })

  const best = candidates.sort((a, b) => b.score - a.score || b.value - a.value)[0]

  if (best) {
    return {
      value: Number(best.value.toFixed(2)),
      confidence:
        best.score >= 90 ? 'high' : best.score >= 65 ? 'medium' : 'low',
      sourceLine: best.line,
      method: 'keyword',
    }
  }

  const fallbackValues = lines
    .filter((line) => {
      const text = line.toLowerCase()

      return (
        !text.includes('iva') &&
        !text.includes('imposta') &&
        !text.includes('ritenuta') &&
        !text.includes('acconto') &&
        !text.includes('saldo')
      )
    })
    .flatMap(extractMoneyValues)

  const fallback = fallbackValues.length > 0 ? Math.max(...fallbackValues) : 0

  if (fallback > 0) {
    return {
      value: Number(fallback.toFixed(2)),
      confidence: 'low',
      method: 'fallback',
    }
  }

  return {
    value: 0,
    confidence: 'none',
    method: 'none',
  }
}