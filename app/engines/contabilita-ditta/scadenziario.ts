import { dataValida } from './riepilogo'

export const TIPI_SCADENZA = ['IVA', 'INPS', 'INAIL', 'IRPEF', 'Ritenute', 'F24'] as const
export const STATI_SCADENZA = ['Previsto', 'Da verificare', 'Da pagare', 'Pagato'] as const
export type StatoScadenza = typeof STATI_SCADENZA[number]
export type Scadenza = {
  id: string
  tipo: string
  periodo: string
  dataScadenza: string
  importoCentesimi: number | null
  stato: StatoScadenza
  nota: string
  riferimento: string
  includiNeiTotali: boolean
  importoPagato?: string | null
  dataPagamento?: string | null
  archiviataAt?: string | null
  motivoArchiviazione?: string | null
  revisione?: string
  updatedAt?: string
}
export type BozzaScadenza = Omit<Scadenza, 'id' | 'importoCentesimi'> & { importo: string }
export type TotaleScadenze = { centesimi: number | null; note: number; importiMancanti: number; riepilogative: number }
const validoImporto = (n: number | null) => n === null || (Number.isSafeInteger(n) && n >= 0)

export function nuovaBozzaScadenza(): BozzaScadenza {
  return { tipo: 'IVA', periodo: '', dataScadenza: '', importo: '', stato: 'Da verificare', nota: '', riferimento: '', includiNeiTotali: true }
}
export function bozzaDaScadenza(r: Scadenza): BozzaScadenza {
  const c = r.importoCentesimi === null ? null : BigInt(r.importoCentesimi)
  return { tipo: r.tipo, periodo: r.periodo, dataScadenza: r.dataScadenza, importo: c === null ? '' : `${c / BigInt(100)}.${String(c % BigInt(100)).padStart(2, '0')}`, stato: r.stato, nota: r.nota, riferimento: r.riferimento, includiNeiTotali: r.includiNeiTotali }
}
export function formattaImportoScadenza(c: number | null): string {
  if (c === null) return 'Da verificare'
  if (!validoImporto(c)) throw Error('Importo non verificabile.')
  const n = BigInt(c)
  return `${(n / BigInt(100)).toLocaleString('it-IT')},${String(n % BigInt(100)).padStart(2, '0')} €`
}
function importoManuale(testo: string): number | null {
  const v = testo.trim()
  if (!v) return null
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(v)) throw Error('Importo: usa euro non negativi con massimo due decimali, senza separatori delle migliaia.')
  const [interi, decimali = ''] = v.replace(',', '.').split('.')
  const n = BigInt(interi) * BigInt(100) + BigInt(decimali.padEnd(2, '0'))
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Importo oltre la precisione verificabile.')
  return Number(n)
}
function testoRichiesto(testo: string, nome: string, max: number): string {
  const v = testo.trim()
  if (!v || v.length > max) throw Error(`${nome}: inserisci un valore di massimo ${max} caratteri.`)
  return v
}
export function validaBozzaScadenza(bozza: BozzaScadenza, id: string): Scadenza {
  if (!id) throw Error('Identità della bozza mancante.')
  const tipo = testoRichiesto(bozza.tipo, 'Tipo', 80), periodo = testoRichiesto(bozza.periodo, 'Periodo di riferimento', 120)
  if (!dataValida(bozza.dataScadenza)) throw Error('Data scadenza non valida: specificarla manualmente dal documento.')
  if (!(STATI_SCADENZA as readonly string[]).includes(bozza.stato)) throw Error('Stato non valido.')
  if (bozza.nota.length > 2000 || bozza.riferimento.length > 300) throw Error('Nota o riferimento troppo lungo.')
  if (typeof bozza.includiNeiTotali !== 'boolean') throw Error('Inclusione nei totali non valida.')
  return { id, tipo, periodo, dataScadenza: bozza.dataScadenza, importoCentesimi: importoManuale(bozza.importo), stato: bozza.stato, nota: bozza.nota.trim(), riferimento: bozza.riferimento.trim(), includiNeiTotali: bozza.includiNeiTotali }
}
export function applicaScadenzaLocale(righe: readonly Scadenza[], riga: Scadenza, modificaId: string | null): Scadenza[] {
  if (modificaId && (modificaId !== riga.id || righe.filter(r => r.id === modificaId).length !== 1)) throw Error('Bozza da modificare non trovata o duplicata.')
  if (!modificaId && righe.some(r => r.id === riga.id)) throw Error('Identità già presente: nessuna aggiunta duplicata.')
  if (righe.some(r => r.id !== modificaId && r.tipo.toLocaleLowerCase('it-IT') === riga.tipo.toLocaleLowerCase('it-IT') && r.periodo.toLocaleLowerCase('it-IT') === riga.periodo.toLocaleLowerCase('it-IT') && r.dataScadenza === riga.dataScadenza && r.riferimento === riga.riferimento)) throw Error('Scadenza con stesso tipo, periodo, data e riferimento già presente: modifica la bozza esistente.')
  return modificaId ? righe.map(r => r.id === modificaId ? riga : r) : [...righe, riga]
}
const giorni = (data: string) => Date.parse(data + 'T12:00:00Z') / 86400000
function totale(righe: readonly Scadenza[]): TotaleScadenze {
  const incluse = righe.filter(r => r.includiNeiTotali)
  let somma = BigInt(0)
  for (const r of incluse) if (r.importoCentesimi !== null) somma += BigInt(r.importoCentesimi)
  return { centesimi: somma > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(somma), note: incluse.filter(r => r.importoCentesimi !== null).length, importiMancanti: incluse.filter(r => r.importoCentesimi === null).length, riepilogative: righe.length - incluse.length }
}
/** Solo previsione manuale in memoria: nessuna scadenza fiscale generata, nessun pagamento. */
export function riepilogaScadenze(righe: readonly Scadenza[], oggi: string) {
  if (!dataValida(oggi)) throw Error('Data di consultazione non valida.')
  const ids = new Set<string>()
  for (const r of righe) {
    if (!r.id || ids.has(r.id) || !dataValida(r.dataScadenza) || !validoImporto(r.importoCentesimi) || typeof r.includiNeiTotali !== 'boolean' || !(STATI_SCADENZA as readonly string[]).includes(r.stato)) throw Error('Bozze locali incoerenti: riepilogo non disponibile.')
    ids.add(r.id)
  }
  const ordinate = [...righe].sort((a, b) => a.dataScadenza.localeCompare(b.dataScadenza) || a.id.localeCompare(b.id))
  const aperte = ordinate.filter(r => r.stato !== 'Pagato')
  const future = aperte.filter(r => r.dataScadenza >= oggi), scadute = aperte.filter(r => r.dataScadenza < oggi)
  const entro = (limite: number) => totale(future.filter(r => giorni(r.dataScadenza) - giorni(oggi) <= limite))
  return { ordinate, aperte: aperte.length, prossima: future[0] || null, scadute: scadute.length, arretrati: totale(scadute), entro30: entro(30), entro60: entro(60), entro90: entro(90) }
}
