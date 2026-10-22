import type { MaterialeEconomiaApprovato, ScomposizioneVarianti, MaterialiOperativi } from './riepilogoEconomico'

export function dettaglioMaterialiVerificato(valori: ScomposizioneVarianti): readonly MaterialeEconomiaApprovato[] {
  const righe = valori.dettaglioMateriali
  if (!Array.isArray(righe) || !Number.isFinite(valori.materiali)) throw Error('Dettaglio materiali non disponibile.')
  const ids = new Set<string>(); let centesimi = 0
  for (const r of righe) {
    if (!r.id || ids.has(r.id) || !r.descrizione.trim() || !r.um.trim() || !Number.isFinite(r.quantita) || r.quantita <= 0 ||
        !Number.isFinite(r.prezzo) || r.prezzo < 0 || !Number.isFinite(r.totale) || r.totale <= 0) throw Error('Dettaglio materiali non verificabile.')
    ids.add(r.id)
    const c = Math.round(r.totale * 100)
    if (!Number.isSafeInteger(c) || Math.abs(r.totale * 100 - c) > 0.000001 || !Number.isSafeInteger(centesimi + c)) throw Error('Dettaglio materiali non verificabile.')
    centesimi += c
  }
  if (Math.abs(valori.materiali * 100 - centesimi) > 0.000001) throw Error('Totale dettaglio diverso da Materiali Economia.')
  return righe
}
export const numeroMateriali = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 6 })
export const prezzoMateriali = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
export const dataMateriali = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v.split('-').reverse().join('/') : v || '—'
const html = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
export function documentoMaterialiEconomia(cantiere: string, valori: ScomposizioneVarianti, data = new Date(), operativi?: MaterialiOperativi): string {
  const righe = dettaglioMaterialiVerificato(valori)
  if (operativi) {
    dettaglioMaterialiVerificato({ ...valori, materiali: operativi.daContabilizzare, dettaglioMateriali: operativi.righe })
    if (Math.round(operativi.totaleOperativo * 100) !== Math.round(valori.materiali * 100) + Math.round(operativi.daContabilizzare * 100)) throw Error('Totale operativo incoerente.')
  }
  if (!cantiere.trim() || !Number.isFinite(data.getTime())) throw Error('Contesto stampa non disponibile.')
  const euro = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Materiali lavori in economia</title><style>
@page{size:A4 landscape;margin:12mm}body{font:11px Arial,sans-serif;color:#172033;line-height:1.4}h1{font-size:20px}
table{width:100%;border-collapse:collapse}th,td{padding:6px;border-bottom:1px solid #ddd;text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:pre-wrap}
thead{display:table-header-group}tr,.totale{break-inside:avoid}.numero{text-align:right;white-space:nowrap}.descrizione{min-width:150px}.totale{text-align:right;font-size:14px;margin-top:18px}
</style></head><body><h1>Materiali lavori in economia</h1><p>Cantiere: ${html(cantiere)}<br>Data stampa: ${html(data.toLocaleDateString('it-IT'))}</p>
<p>Dettaglio contrattuale congelato nelle Varianti approvate.</p><table><thead><tr>${['Data', 'Fornitore', 'Fattura', 'Descrizione', 'Quantità', 'U.M.', 'Prezzo unitario €', 'Totale', 'Raccolta / riferimento Economia', 'Stato'].map(t => `<th>${t}</th>`).join('')}</tr></thead><tbody>
${righe.map(r => `<tr><td>${html(dataMateriali(r.data))}</td><td>${html(r.fornitore || '—')}</td><td>${html(r.fattura || '—')}</td><td class="descrizione">${html(r.descrizione)}</td><td class="numero">${html(numeroMateriali(r.quantita))}</td><td>${html(r.um)}</td><td class="numero">${html(prezzoMateriali(r.prezzo))}</td><td class="numero">${html(euro(r.totale))}</td><td>${html(r.riferimento)}</td><td>Approvato</td></tr>`).join('')}
</tbody></table><p class="totale"><strong>Totale Materiali Economia: ${html(euro(valori.materiali))}</strong></p></body></html>`
    .replace('<table>', '<h2>Materiali approvati — Approvato</h2><table>')
    .replace('</body>', operativi ? `<h2>Materiali da contabilizzare</h2><table><thead><tr>${['Data', 'Fornitore', 'Fattura', 'Descrizione', 'Quantità', 'U.M.', 'Prezzo Economia €', 'Totale', 'Raccolta Economia', 'Stato'].map(t => `<th>${t}</th>`).join('')}</tr></thead><tbody>${operativi.righe.map(r => `<tr>${[dataMateriali(r.data), r.fornitore || '—', r.fattura || '—', r.descrizione, numeroMateriali(r.quantita), r.um, prezzoMateriali(r.prezzo), euro(r.totale), r.riferimento, 'Da contabilizzare'].map(v => `<td>${html(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
<p class="totale">Totale approvati: ${html(euro(valori.materiali))}<br>Totale da contabilizzare: ${html(euro(operativi.daContabilizzare))}<br><strong>Totale materiali presenti in Economia: ${html(euro(operativi.totaleOperativo))}</strong></p><p>Le righe da contabilizzare non sono ancora comprese nel valore contrattuale approvato.</p></body>` : '</body>')
}
