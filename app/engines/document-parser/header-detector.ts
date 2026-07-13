export type DocumentColumnMap = {
  codice?: number
  descrizione?: number
  unitaMisura?: number
  quantita?: number
  prezzoUnitario?: number
  totale?: number
}

export type DocumentHeaderDetection = {
  headerRowIndex: number
  columns: DocumentColumnMap
  score: number
}

type DocumentColumnKey = keyof DocumentColumnMap

const HEADER_ALIASES: Record<DocumentColumnKey, string[]> = {
  codice: [
    'codice',
    'cod',
    'art',
    'articolo',
    'voce',
    'id',
  ],

  descrizione: [
    'descrizione',
    'lavorazione',
    'opera',
    'prestazione',
  ],

  unitaMisura: [
    'um',
    'u m',
    'unita',
    'unita misura',
    'misura',
  ],

  quantita: [
    'quantita',
    'qta',
    'qty',
  ],

  prezzoUnitario: [
    'prezzo',
    'prezzo unitario',
    'prezzo euro',
    'p u',
    'unitario',
  ],

  totale: [
    'totale',
    'importo',
    'tot',
    'importo euro',
  ],
}

const normalizzaIntestazione = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[€]/g, ' euro ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const riconosciColonna = (
  value: unknown,
): DocumentColumnKey | null => {
  const valoreNormalizzato = normalizzaIntestazione(value)

  if (!valoreNormalizzato) {
    return null
  }

  const columnKeys = Object.keys(
    HEADER_ALIASES,
  ) as DocumentColumnKey[]

  for (const columnKey of columnKeys) {
    const aliases = HEADER_ALIASES[columnKey]

    if (aliases.includes(valoreNormalizzato)) {
      return columnKey
    }
  }

  return null
}

export const detectDocumentHeader = (
  rows: unknown[][],
  maxRowsToScan = 15,
): DocumentHeaderDetection | null => {
  const rowsToScan = rows.slice(0, maxRowsToScan)

  let bestDetection: DocumentHeaderDetection | null = null

  rowsToScan.forEach((row, rowIndex) => {
    const columns: DocumentColumnMap = {}

    row.forEach((cell, columnIndex) => {
      const columnKey = riconosciColonna(cell)

      if (!columnKey) {
        return
      }

      if (columns[columnKey] === undefined) {
        columns[columnKey] = columnIndex
      }
    })

    const score = Object.keys(columns).length

    if (
      score >= 2 &&
      (!bestDetection || score > bestDetection.score)
    ) {
      bestDetection = {
        headerRowIndex: rowIndex,
        columns,
        score,
      }
    }
  })

  return bestDetection
}