export interface ReportNarrationContext {
  cantiere?: string
  data?: string
  cantieriDisponibili?: string[]
  operaiDisponibili?: string[]
  materialiDisponibili?: string[]
}

export interface ParsedReport {
  confidence: number
  cantiere?: string
  data?: string
  operai: any[]
  materiali: any[]
  lavorazioni: string[]
  note: string
  warnings: string[]
}

type ParsedMaterial = {
  nome: string
  quantita?: number
  unita?: string
}

const materialKeywords = [
  { nome: 'premiscelato', termini: ['premiscelato', 'premiscelati'] },
  { nome: 'cemento', termini: ['cemento'] },
  { nome: 'tubo', termini: ['tubo', 'tubi'] },
  { nome: 'rete', termini: ['rete', 'reti'] },
  { nome: 'collante', termini: ['collante', 'collanti'] },
  { nome: 'intonaco', termini: ['intonaco', 'intonaci'] },
  { nome: 'cartongesso', termini: ['cartongesso'] },
  { nome: 'pittura', termini: ['pittura', 'pitture'] },
]

const lavorazioniKeywords = [
  'demolizione',
  'impianto',
  'intonaco',
  'massetto',
  'piastrelle',
  'rasatura',
  'pittura',
]

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

const containsTerm = (normalizedNarration: string, term: string) => {
  const normalizedTerm = normalizeText(term)

  if (!normalizedTerm) return false

  return ` ${normalizedNarration} `.includes(` ${normalizedTerm} `)
}

const calculateConfidence = (recognizedElements: number) => {
  if (recognizedElements === 0) return 0
  if (recognizedElements === 1) return 0.3
  if (recognizedElements === 2) return 0.5
  if (recognizedElements === 3) return 0.7

  return 0.9
}

/**
 * Flusso futuro:
 *
 * Speech
 *   v
 * Speech To Text
 *   v
 * Report Parser
 *   v
 * Document Intelligence
 *   v
 * Engine Registry
 *   v
 * Rapportino
 *   v
 * Database
 */
export function parseReportNarration(
  narration: string,
  context: ReportNarrationContext
): ParsedReport {
  const normalizedNarration = normalizeText(narration)

  const cantieri = [
    context.cantiere,
    ...(context.cantieriDisponibili || []),
  ].filter((cantiere): cantiere is string => Boolean(cantiere?.trim()))

  const cantiere = cantieri.find((nome) =>
    containsTerm(normalizedNarration, nome)
  )

  const operai = (context.operaiDisponibili || []).filter((operaio) =>
    containsTerm(normalizedNarration, operaio)
  )

  const materialiRiconosciuti = new Map<string, ParsedMaterial>()

  const aggiungiMateriale = (materiale: ParsedMaterial) => {
    const key = normalizeText(materiale.nome)
    const esistente = materialiRiconosciuti.get(key)

    materialiRiconosciuti.set(key, { ...materiale, ...esistente })
  }

  for (const materiale of context.materialiDisponibili || []) {
    if (containsTerm(normalizedNarration, materiale)) {
      aggiungiMateriale({ nome: materiale })
    }
  }

  for (const materiale of materialKeywords) {
    if (
      materiale.termini.some((termine) =>
        containsTerm(normalizedNarration, termine)
      )
    ) {
      aggiungiMateriale({ nome: materiale.nome })
    }
  }

  const quantityPattern =
    /\b(\d+(?:[.,]\d+)?)\s+(sacchi?|tubi?|pannelli?)\b/gi

  for (const match of narration.matchAll(quantityPattern)) {
    const quantita = Number(match[1].replace(',', '.'))
    const unitaRilevata = normalizeText(match[2])
    const nome = unitaRilevata.startsWith('sacc')
      ? 'sacco'
      : unitaRilevata.startsWith('tub')
        ? 'tubo'
        : 'pannello'

    aggiungiMateriale({
      nome,
      quantita,
      unita: match[2].toLowerCase(),
    })
  }

  const materiali = Array.from(materialiRiconosciuti.values())
  const lavorazioni = lavorazioniKeywords.filter((lavorazione) =>
    containsTerm(normalizedNarration, lavorazione)
  )

  const warnings: string[] = []

  if (!cantiere) warnings.push('Aggiungere il cantiere.')
  if (operai.length === 0) warnings.push('Nessun operaio riconosciuto.')
  if (materiali.length === 0) warnings.push('Nessun materiale riconosciuto.')

  const recognizedElements =
    (cantiere ? 1 : 0) +
    operai.length +
    materiali.length +
    lavorazioni.length

  return {
    confidence: calculateConfidence(recognizedElements),
    cantiere,
    data: context.data,
    note: narration,
    operai,
    materiali,
    lavorazioni,
    warnings,
  }
}
