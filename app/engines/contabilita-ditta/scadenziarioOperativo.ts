import { bozzaDaScadenza, validaBozzaScadenza, type Scadenza } from './scadenziario'
import { dataValida } from './riepilogo'

export const FILTRI_SCADENZE = ['Aperte', 'Da verificare', 'Da pagare', 'Pagate', 'Archiviate', 'Tutte'] as const
export type FiltroScadenze = typeof FILTRI_SCADENZE[number]
export type BozzaPagamentoScadenza = { importo: string; data: string; riferimento: string; nota: string; chiusuraConfermata: boolean }
export function importoDecimale(c: number | null): string {
  if (c === null) return ''
  return `${BigInt(c) / BigInt(100)}.${String(BigInt(c) % BigInt(100)).padStart(2, '0')}`
}
export function pagatoCentesimi(r: Scadenza): number | null {
  if (r.importoPagato == null) return null
  return validaBozzaScadenza({ ...bozzaDaScadenza(r), importo: r.importoPagato }, r.id).importoCentesimi
}
export function residuoScadenza(r: Scadenza): number | null {
  const pagato = pagatoCentesimi(r)
  return r.importoCentesimi === null || pagato === null ? null : Math.max(0, r.importoCentesimi - pagato)
}
export function nuovaBozzaPagamento(r: Scadenza, oggi: string): BozzaPagamentoScadenza {
  return { importo: importoDecimale(r.importoCentesimi), data: oggi, riferimento: r.riferimento, nota: r.nota, chiusuraConfermata: false }
}
/** Annotazione cumulativa dell'obbligo: nessuna rata, quietanza o movimento economico. */
export function preparaPagamentoScadenza(r: Scadenza, b: BozzaPagamentoScadenza) {
  if (r.archiviataAt || r.stato === 'Pagato') throw Error('Scadenza non aperta: rileggere.')
  const c = validaBozzaScadenza({ ...bozzaDaScadenza(r), importo: b.importo, nota: b.nota, riferimento: b.riferimento }, r.id).importoCentesimi
  if (c !== null && c > 99999999999999) throw Error('Importo oltre il contratto persistente.')
  if (!dataValida(b.data)) throw Error('Data pagamento non valida.')
  const coperta = c !== null && r.importoCentesimi !== null && c >= r.importoCentesimi
  return { scadenza: { ...r, stato: coperta || b.chiusuraConfermata ? 'Pagato' as const : 'Da pagare' as const, nota: b.nota.trim(), riferimento: b.riferimento.trim() }, importoPagato: c === null ? null : importoDecimale(c), dataPagamento: c === null ? null : b.data }
}
export function filtraScadenze(righe: readonly Scadenza[], filtro: FiltroScadenze): Scadenza[] {
  return righe.filter(r => filtro === 'Tutte' || (filtro === 'Archiviate' ? Boolean(r.archiviataAt) : !r.archiviataAt && (filtro === 'Aperte' ? r.stato !== 'Pagato' : filtro === 'Pagate' ? r.stato === 'Pagato' : r.stato === filtro)))
    .sort((a, b) => a.dataScadenza.localeCompare(b.dataScadenza) || a.id.localeCompare(b.id))
}
export function evidenzaScadenza(r: Scadenza, oggi: string): string {
  if (r.archiviataAt) return 'Archiviata'
  if (r.stato === 'Pagato') return 'Pagata'
  const giorni = (Date.parse(r.dataScadenza + 'T12:00:00Z') - Date.parse(oggi + 'T12:00:00Z')) / 86400000
  return giorni < 0 ? 'Scaduta' : giorni === 0 ? 'Oggi' : giorni <= 7 ? 'Entro 7 giorni' : giorni <= 30 ? 'Entro 30 giorni' : 'Futura'
}
export function totaleScaduto(righe: readonly Scadenza[], oggi: string): number | null {
  let somma = BigInt(0)
  for (const r of righe.filter(r => !r.archiviataAt && r.stato !== 'Pagato' && r.includiNeiTotali && r.dataScadenza < oggi)) {
    const residuo = residuoScadenza(r)
    if (residuo === null) return null
    somma += BigInt(residuo)
  }
  return somma > BigInt(Number.MAX_SAFE_INTEGER) ? null : Number(somma)
}
