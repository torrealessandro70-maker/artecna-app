import * as XLSX from 'xlsx'
import type { AnteprimaFattura } from './import-documenti'

// Alias finiti: nessuna ricerca per sottostringhe o inferenza di colonne.
const colonne = {
  fornitore: ['fornitore'], numero: ['numero fattura', 'numero_fattura'], data: ['data', 'data fattura', 'data_fattura'],
  descrizione: ['descrizione'], quantita: ['quantita', 'quantità'], prezzo: ['prezzo unitario', 'prezzo_unitario'],
  totale: ['totale', 'totale riga', 'totale_riga'], partitaIva: ['partita iva', 'partita_iva'],
  um: ['um', 'u.m.', 'unita_misura', 'unità di misura'], iva: ['aliquota iva', 'aliquota_iva'],
  totaleDocumento: ['totale documento', 'totale_documento'],
} as const
type Colonna = keyof typeof colonne
const stringa = (v: unknown) => String(v ?? '').trim()
function numero(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const s = stringa(v)
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(s)) throw Error(`Numero assente o ambiguo: ${s || 'vuoto'}.`)
  const n = Number(s.replace(',', '.'))
  if (!Number.isFinite(n)) throw Error('Numero non valido.')
  return n
}
function dataFattura(v: unknown): string {
  let s = stringa(v)
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (!d) throw Error('Data Excel non valida.')
    s = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) s = s.slice(6) + '-' + s.slice(3, 5) + '-' + s.slice(0, 2)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s)
    throw Error('Data ambigua: usare AAAA-MM-GG o GG/MM/AAAA.')
  return s
}
export async function leggiFattureTabellari(file: File): Promise<AnteprimaFattura[]> {
  // Il CSV è testo UTF-8: la lettura binaria predefinita di SheetJS perde gli accenti.
  const workbook = file.name.toLowerCase().endsWith('.csv')
    ? XLSX.read(await file.text(), { type: 'string', raw: true, cellDates: false })
    : XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true, cellDates: false })
  const sheets = workbook.SheetNames.filter(n => workbook.Sheets[n]['!ref'])
  if (sheets.length !== 1) throw Error('Serve un solo foglio dati: file vuoto o con più fogli ambiguo.')
  const sheet = workbook.Sheets[sheets[0]]
  if (Object.keys(sheet).some(k => !k.startsWith('!') && sheet[k].f)) throw Error('Formule non ammesse: usare valori espliciti.')
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' })
  const header = grid.findIndex(row => row.some(v => stringa(v)))
  if (header < 0) throw Error('File senza intestazioni.')
  const mapping: Partial<Record<Colonna, number>> = {}
  grid[header].forEach((v, i) => {
    const name = stringa(v).toLowerCase()
    const key = (Object.keys(colonne) as Colonna[]).find(k => (colonne[k] as readonly string[]).includes(name))
    if (key) {
      if (mapping[key] !== undefined) throw Error(`Colonna duplicata: ${name}.`)
      mapping[key] = i
    }
  })
  for (const key of ['fornitore', 'numero', 'data', 'descrizione', 'quantita', 'prezzo', 'totale'] as Colonna[])
    if (mapping[key] === undefined) throw Error(`Intestazione obbligatoria non riconosciuta: ${key}.`)
  const gruppi = new Map<string, AnteprimaFattura>()
  const dichiarati = new Map<string, number>()
  for (let i = header + 1; i < grid.length; i++) {
    const row = grid[i]
    if (!row.some(v => stringa(v))) continue
    const value = (key: Colonna) => mapping[key] === undefined ? '' : row[mapping[key]!]
    const fornitore = stringa(value('fornitore')), descrizione = stringa(value('descrizione'))
    // La formattazione della cella conserva eventuali zeri iniziali del numero fattura.
    const cellaNumero = sheet[XLSX.utils.encode_cell({ r: i, c: mapping.numero! })]
    const numeroFattura = stringa(cellaNumero?.w ?? value('numero')), partitaIva = stringa(value('partitaIva'))
    if (!fornitore || !numeroFattura || !descrizione) throw Error(`Riga ${i + 1}: dati fattura incompleti.`)
    const data = dataFattura(value('data')), key = JSON.stringify([fornitore, numeroFattura, data])
    let preview = gruppi.get(key)
    if (!preview) {
      preview = { fornitore, partitaIva, numero: numeroFattura, data, totale: '0', nomeFile: file.name,
        tipoFile: file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'excel', testoOriginale: '', righe: [] }
      gruppi.set(key, preview)
    }
    if (preview.partitaIva !== partitaIva) throw Error('Partita IVA discordante nella stessa fattura.')
    const iva = stringa(value('iva')) ? numero(value('iva')) : undefined
    if (iva !== undefined && (iva < 0 || iva > 100)) throw Error('Aliquota IVA non valida.')
    preview.righe.push({ numero_riga: preview.righe.length + 1, descrizione, quantita: numero(value('quantita')),
      prezzo_unitario: numero(value('prezzo')), totale_riga: numero(value('totale')), cantiere: '',
      unita_misura: stringa(value('um')), aliquota_iva: iva })
    if (stringa(value('totaleDocumento'))) {
      const totale = numero(value('totaleDocumento'))
      if (dichiarati.has(key) && dichiarati.get(key) !== totale) throw Error('Totale documento discordante.')
      dichiarati.set(key, totale)
    }
  }
  if (!gruppi.size) throw Error('Nessuna riga fattura riconosciuta.')
  for (const [key, preview] of gruppi) {
    const totaleRighe = preview.righe.reduce((s, r) => s + r.totale_riga, 0)
    const totale = dichiarati.get(key) ?? Math.round(totaleRighe * 100) / 100
    preview.totale = String(totale)
  }
  return [...gruppi.values()]
}
