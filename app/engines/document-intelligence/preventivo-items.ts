export type VoceAnalizzata = {
  codice?: string
  descrizione: string
  quantita?: number
  unita?: string
  prezzo?: number
  totale?: number
  importoCoerente?: boolean
}

const unitaPattern = /^(?:mq\/cm|mq|mc|m|m2|m3|m²|m³|ml|cm|mm|kg|g|t|lt|l|cad|cad\.|pz|nr|n\.|h|ora|ore|a corpo|corpo)$/i
const numeroPattern = /^(?:€\s*)?-?\d+(?:[.,]\d+)*(?:\s*€)?$/
const metadatoPattern = /^(?:totale|iva\b|acconto\b|saldo\b|stato avanzamento|sal\b|imponibile\b)/i

// Reuses the application's number normalizer; no PDF parsing or persistence here.
export function parsePreventivoItems(text: string, parseNumero: (value: string) => number): VoceAnalizzata[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const rows: VoceAnalizzata[] = []
  const makeRow = (descrizione: string, unita: string, quantita: string, prezzo: string, totale?: string): VoceAnalizzata => {
    const q = parseNumero(quantita)
    const p = parseNumero(prezzo)
    const amount = totale === undefined ? undefined : parseNumero(totale)
    return {
      descrizione, unita, quantita: q, prezzo: p,
      ...(amount === undefined ? {} : {
        totale: amount,
        importoCoerente: Math.abs(q * p - amount) <= Math.max(0.02, Math.abs(amount) * 0.01),
      }),
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const cells = lines[i].split('|').map((cell) => cell.trim()).filter(Boolean)
    if (cells.length >= 4 && !metadatoPattern.test(cells[0]) &&
        numeroPattern.test(cells[2]) && numeroPattern.test(cells[3])) {
      rows.push(makeRow(cells[0], cells[1], cells[2], cells[3],
        cells[4] && numeroPattern.test(cells[4]) ? cells[4] : undefined))
      continue
    }
  }
  // Find economic tails independently of line breaks. Numbers inside descriptions
  // cannot open a row: only the expected ordinal between two valid tails can.
  const flat = text.replace(/\s+/g, ' ').trim()
  const number = String.raw`-?\d+(?:[.,]\d+)*`
  const units = unitaPattern.source.slice(1, -1)
  const tail = new RegExp(String.raw`(?:^|\s)(${units})\s*(${number})\s+(${number})\s*€?\s+(${number})\s*€?(?=\s|$)`, 'gi')
  let end = 0
  let expected: number | undefined
  for (const match of flat.matchAll(tail)) {
    const prefix = flat.slice(end, match.index)
    const starts = [...prefix.matchAll(/(?:^|\s)(\d+)\s+(?=[A-Za-zÀ-ÿ])/g)]
    const start = starts.find((candidate) => expected === undefined ? Number(candidate[1]) === 1 : Number(candidate[1]) === expected)
    if (!start) continue
    const description = prefix.slice(start.index! + start[0].length).trim()
    if (!description || metadatoPattern.test(description)) continue
    rows.push(makeRow(description, match[1], match[2], match[3], match[4]))
    expected = Number(start[1]) + 1
    end = match.index! + match[0].length
  }
  return rows
}
