import { statoVisibileManodopera } from './manodoperaEconomiaDettaglio'
import type { DettaglioManodoperaEconomia, VoceManodoperaEconomia } from './manodoperaEconomiaDettaglio'
import { numeroMateriali, prezzoMateriali, dataMateriali } from './stampaMaterialiEconomia'

const escape = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const euro = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
export function documentoManodoperaEconomia(cantiere: string, dati: DettaglioManodoperaEconomia, data = new Date()): string {
  if (!cantiere.trim() || !Number.isFinite(data.getTime())) throw Error('Contesto stampa non disponibile.')
  const ids = new Set<string>()
  const verifica = (righe: VoceManodoperaEconomia[], totale: number | null, stato: VoceManodoperaEconomia['stato']) => {
    let centesimi = 0
    for (const r of righe) {
      if (r.totale === null && r.prezzo === null && stato === 'Da contabilizzare') {
        if (!r.id || ids.has(r.id) || r.stato !== stato || !Number.isFinite(r.quantita) || r.quantita <= 0) throw Error('Riga non valorizzata incoerente.')
        ids.add(r.id); continue
      }
      if (r.totale === null || r.prezzo === null) throw Error('Riga stampa non valorizzata.')
      const c = Math.round(r.totale * 100)
      if (!r.id || ids.has(r.id) || r.stato !== stato || !Number.isFinite(r.quantita) || r.quantita <= 0 ||
          !Number.isFinite(r.prezzo) || r.prezzo < 0 || !Number.isSafeInteger(c) || c < 0 || Math.abs(c - r.totale * 100) > 0.000001) throw Error('Righe stampa incoerenti.')
      ids.add(r.id); centesimi += c
    }
    const incompleto = righe.some(r => r.totale === null)
    if (incompleto !== (totale === null) || !Number.isSafeInteger(centesimi) || (totale !== null && (!Number.isFinite(totale) || Math.abs(centesimi - totale * 100) > 0.000001))) throw Error('Totale stampa incoerente.')
    return centesimi / 100
  }
  verifica(dati.approvate, dati.totaleApprovato, 'Approvato'); const parziale = verifica(dati.pendenti, dati.totalePendenti, 'Da contabilizzare')
  if (parziale !== dati.totalePendentiValorizzati || (dati.totalePendenti === null) !== (dati.totaleOperativo === null) ||
      (dati.totaleOperativo !== null && (!Number.isFinite(dati.totaleOperativo) || Math.abs(dati.totaleOperativo * 100 - Math.round(dati.totaleApprovato * 100) - Math.round(parziale * 100)) > 0.000001))) throw Error('Totale operativo incoerente.')
  const importo = (n: number | null) => n === null ? 'Non completo: righe da valorizzare' : euro(n)
  const sezione = (titolo: string, righe: VoceManodoperaEconomia[], totale: number | null) => `<h2>${titolo}</h2><table><thead><tr>${['Data','Descrizione / lavorazione','Operaio / riferimento rapportino','Ore / quantità','U.M.','Prezzo unitario','Totale','Raccolta Economia','Stato'].map(t => `<th>${t}</th>`).join('')}</tr></thead><tbody>${righe.map(r => `<tr>${[dataMateriali(r.data), r.descrizione, r.operaioRiferimento || '—', numeroMateriali(r.quantita), r.um, r.prezzo === null ? 'Da valorizzare' : prezzoMateriali(r.prezzo), r.totale === null ? 'Da valorizzare' : euro(r.totale), r.riferimento, statoVisibileManodopera(r)].map(v => `<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="totale">Totale ${titolo.toLowerCase()}: ${escape(importo(totale))}</p>`
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Manodopera lavori in economia</title><style>@page{size:A4 landscape;margin:12mm}body{font:11px Arial,sans-serif;color:#172033}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:6px;border-bottom:1px solid #ddd;white-space:pre-wrap;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}.totale{text-align:right;font-weight:bold}</style></head><body><h1>Manodopera lavori in economia</h1><p>Cantiere: ${escape(cantiere)}<br>Data stampa: ${escape(data.toLocaleDateString('it-IT'))}</p>${sezione('Manodopera approvata', dati.approvate, dati.totaleApprovato)}${sezione('Manodopera da contabilizzare', dati.pendenti, dati.totalePendenti)}<p class="totale">Totale operativo manodopera: ${escape(importo(dati.totaleOperativo))}</p>${dati.totalePendenti === null ? `<p>Subtotale pendenti già valorizzati: ${escape(euro(parziale))}. Le righe da valorizzare non sono considerate zero.</p>` : ''}<p>La manodopera da contabilizzare non è ancora compresa nel valore contrattuale approvato. Gli importi sono valori cliente, non costi aziendali.</p></body></html>`
}
