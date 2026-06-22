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
  operai: ParsedReportWorker[]
  materiali: ParsedMaterial[]
  lavorazioni: string[]
  attivitaDaFare: string[]
  promemoriaSuggeriti: ParsedReportReminder[]
  note: string
  warnings: string[]
}

export interface ParsedReportReminder {
  testo: string
  dataSuggerita?: string
}

export interface ParsedReportWorker {
  nome: string
  ora_inizio?: string
  ora_fine?: string
  ore: number
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

const taskKeywords = [
  'domani',
  'bisogna',
  'dobbiamo',
  'da fare',
  'ricordare',
  'ricordati',
  'serve',
  'manca',
  'ordinare',
  'chiamare',
  'contattare',
  'comprare',
  'ritirare',
  'consegnare',
  'verificare',
  'finire',
  'completare',
]

const taskActionKeywords = [
  'ordinare',
  'chiamare',
  'contattare',
  'comprare',
  'ritirare',
  'consegnare',
  'verificare',
  'finire',
  'completare',
]

const reminderKeywords = [
  'ricordami',
  'ricordare',
  'promemoria',
  'domani',
  'lunedì',
  'martedì',
  'mercoledì',
  'giovedì',
  'venerdì',
  'sabato',
  'domenica',
]

const reminderDates = [
  { value: 'domani', terms: ['domani'] },
  { value: 'lunedì', terms: ['lunedì', 'lunedi'] },
  { value: 'martedì', terms: ['martedì', 'martedi'] },
  { value: 'mercoledì', terms: ['mercoledì', 'mercoledi'] },
  { value: 'giovedì', terms: ['giovedì', 'giovedi'] },
  { value: 'venerdì', terms: ['venerdì', 'venerdi'] },
  { value: 'sabato', terms: ['sabato'] },
  { value: 'domenica', terms: ['domenica'] },
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

const capitalizeFirst = (value: string) =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value

const extractTasks = (narration: string) => {
  const tasks = new Map<string, string>()
  const actionPattern = taskActionKeywords.join('|')
  const taskPrefixPattern = new RegExp(
    `^.*?\\b(?:${taskKeywords.join('|').replace('da fare', 'da\\s+fare')})\\b\\s*`,
    'i'
  )

  const addTask = (value: string) => {
    const cleanValue = value
      .trim()
      .replace(/^(?:e|poi)\s+/i, '')
      .replace(/[.,;:!?]+$/g, '')
      .trim()
    const normalizedValue = normalizeText(cleanValue)

    if (!normalizedValue) return

    tasks.set(normalizedValue, capitalizeFirst(cleanValue))
  }

  for (const sentence of narration.split(/[.!?;\n]+/)) {
    const normalizedSentence = normalizeText(sentence)

    if (!taskKeywords.some((keyword) => containsTerm(normalizedSentence, keyword))) {
      continue
    }

    const actionRegex = new RegExp(
      `\\b(?:${actionPattern})\\b.*?(?=\\s+(?:e|poi)\\s+(?=(?:${actionPattern})\\b)|,\\s*(?=(?:${actionPattern})\\b)|$)`,
      'gi'
    )
    const actions = Array.from(sentence.matchAll(actionRegex), (match) => match[0])

    if (actions.length > 0) {
      actions.forEach(addTask)
      continue
    }

    addTask(sentence.replace(taskPrefixPattern, ''))
  }

  return Array.from(tasks.values())
}

const extractSuggestedReminders = (narration: string) => {
  const reminders = new Map<string, ParsedReportReminder>()
  const datePattern = reminderDates.flatMap((date) => date.terms).join('|')

  for (const sentence of narration.split(/[.!?;\n]+/)) {
    const normalizedSentence = normalizeText(sentence)

    if (
      !reminderKeywords.some((keyword) =>
        containsTerm(normalizedSentence, keyword)
      )
    ) {
      continue
    }

    const dataSuggerita = reminderDates.find((date) =>
      date.terms.some((term) => containsTerm(normalizedSentence, term))
    )?.value
    const cleanText = sentence
      .trim()
      .replace(
        /^.*?\b(?:ricordami|ricordare|promemoria)\b(?:\s+di)?\s*/i,
        ''
      )
      .replace(
        new RegExp(
          `(?:^|\\s)(?:per\\s+)?(?:${datePattern})(?=\\s|[,.:]|$)`,
          'gi'
        ),
        ' '
      )
      .replace(/^(?:di|che)\s+/i, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/^[,;:\s]+|[,;:\s]+$/g, '')
      .trim()
    const normalizedText = normalizeText(cleanText)

    if (!normalizedText) continue

    const reminder = {
      testo: capitalizeFirst(cleanText),
      ...(dataSuggerita ? { dataSuggerita } : {}),
    }
    reminders.set(`${normalizedText}|${dataSuggerita || ''}`, reminder)
  }

  return Array.from(reminders.values())
}

const calculateConfidence = (recognizedElements: number) => {
  if (recognizedElements === 0) return 0
  if (recognizedElements === 1) return 0.3
  if (recognizedElements === 2) return 0.5
  if (recognizedElements === 3) return 0.7

  return 0.9
}

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const recognizeRelativeDate = (normalizedNarration: string) => {
  const relativeDate = normalizedNarration
    .split(' ')
    .find((word) => word === 'oggi' || word === 'ieri' || word === 'domani')

  if (!relativeDate) return undefined

  const date = new Date()
  date.setHours(12, 0, 0, 0)

  if (relativeDate === 'ieri') date.setDate(date.getDate() - 1)
  if (relativeDate === 'domani') date.setDate(date.getDate() + 1)

  return formatLocalDate(date)
}

type RecognizedTimeRange = {
  ora_inizio: string
  ora_fine: string
  ore: number
}

const recognizeTimeRange = (narration: string): RecognizedTimeRange | undefined => {
  const time = '([01]?\\d|2[0-3])(?::([0-5]\\d))?'
  const patterns = [
    new RegExp(`\\bdalle\\s+${time}\\s+alle\\s+${time}\\b`, 'i'),
    new RegExp(`\\b${time}\\s*[-–]\\s*${time}\\b`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = narration.match(pattern)

    if (!match) continue

    const startHour = Number(match[1])
    const startMinute = Number(match[2] || 0)
    const endHour = Number(match[3])
    const endMinute = Number(match[4] || 0)
    const startTotalMinutes = startHour * 60 + startMinute
    const endTotalMinutes = endHour * 60 + endMinute

    if (endTotalMinutes <= startTotalMinutes) return undefined

    return {
      ora_inizio: `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')}`,
      ora_fine: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
      ore: (endTotalMinutes - startTotalMinutes) / 60,
    }
  }

  return undefined
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

  const nomiOperai = (context.operaiDisponibili || []).filter((operaio) =>
    containsTerm(normalizedNarration, operaio)
  )
  const timeRange = recognizeTimeRange(narration)
  const operai = nomiOperai.map((nome) => ({
    nome,
    ora_inizio: timeRange?.ora_inizio,
    ora_fine: timeRange?.ora_fine,
    ore: timeRange?.ore || 0,
  }))
  const relativeDate = recognizeRelativeDate(normalizedNarration)

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
  const attivitaDaFare = extractTasks(narration)
  const promemoriaSuggeriti = extractSuggestedReminders(narration)

  const warnings: string[] = []

  if (!cantiere) warnings.push('Aggiungere il cantiere.')
  if (operai.length === 0) warnings.push('Nessun operaio riconosciuto.')
  if (operai.length > 0 && !timeRange) {
    warnings.push('Operai riconosciuti ma ore non indicate.')
  }
  if (materiali.length === 0) warnings.push('Nessun materiale riconosciuto.')

  const recognizedElements =
    (cantiere ? 1 : 0) +
    operai.length +
    materiali.length +
    lavorazioni.length +
    attivitaDaFare.length +
    promemoriaSuggeriti.length +
    (relativeDate ? 1 : 0) +
    (timeRange ? 1 : 0)

  return {
    confidence: calculateConfidence(recognizedElements),
    cantiere,
    data: relativeDate || context.data,
    note: narration,
    operai,
    materiali,
    lavorazioni,
    attivitaDaFare,
    promemoriaSuggeriti,
    warnings,
  }
}
