import type { IdentitaEconomia } from './originiEconomiaExport'
type Lavoro = {
  id: string | number; descrizione: string; operazione: string; delta_contratto: number | string
  riferimento_preventivo_lavorazione_id?: string | number | null
  riferimento_variante_lavorazione_id?: string | number | null
  variante: { titolo?: string | null; data_variante?: string | null; approvata_at?: string | null }
}
type RigaSal = { source_lavorazione_id?: string | number | null; source_variante_lavorazione_id?: string | number | null; descrizione?: string }
type Totali = { incrementi: number; riduzioni: number; delta: number }
export type DettaglioAggiornamenti = {
  cantiere: string
  righe: (IdentitaEconomia & { numero: number; data: string; approvata: string; variante: string; descrizione: string; origine: string; tipo: string; importo: number })[]
  totali: Totali
}
const tipi: Record<string, string> = { nuova: 'Incremento', aumento: 'Incremento', riduzione_residua: 'Riduzione', eliminazione_residua: 'Eliminazione' }
const data = (v?: string | null) => v && Number.isFinite(new Date(v).getTime()) ? new Date(v).toLocaleDateString('it-IT') : 'Data non disponibile'
function centesimi(v: number | string) {
  if ((typeof v !== 'number' && typeof v !== 'string') || String(v).trim() === '') throw Error('Importo non verificabile')
  const n = Number(v), c = Math.round(n * 100)
  if (!Number.isFinite(n) || !Number.isSafeInteger(c) || Math.abs(n * 100 - c) > 0.000001) throw Error('Importo non verificabile')
  return c
}

export function preparaAggiornamentiContrattuali(cantiere: string, lavori: Lavoro[], righeSal: RigaSal[], verificabile: boolean, totali?: Totali): DettaglioAggiornamenti {
  if (!verificabile || !lavori.length) throw Error('Dettaglio non disponibile')
  const ids = new Set<string>(); let incrementi = 0, riduzioni = 0
  const righe = lavori.map((l, indice) => {
    const id = String(l.id), c = centesimi(l.delta_contratto)
    if (!l.id || ids.has(id) || !tipi[l.operazione] || !l.variante || typeof l.descrizione !== 'string' ||
      (tipi[l.operazione] === 'Incremento' ? c <= 0 : c >= 0)) throw Error('Riga non verificabile')
    ids.add(id)
    if (c > 0) incrementi += c; else riduzioni -= c
    const origine = righeSal.find(r => l.riferimento_preventivo_lavorazione_id != null
      ? String(r.source_lavorazione_id) === String(l.riferimento_preventivo_lavorazione_id)
      : l.riferimento_variante_lavorazione_id != null && String(r.source_variante_lavorazione_id) === String(l.riferimento_variante_lavorazione_id))
    const componente = lavori.find(r => l.riferimento_variante_lavorazione_id != null && String(r.id) === String(l.riferimento_variante_lavorazione_id))
    return { economiaStato: 'origine Economia non verificata' as const, numero: indice + 1, data: data(l.variante.data_variante), approvata: l.variante.approvata_at ? data(l.variante.approvata_at) : '',
      variante: l.variante.titolo || 'Senza titolo', descrizione: l.descrizione, origine: origine?.descrizione || componente?.descrizione || '', tipo: tipi[l.operazione], importo: c / 100 }
  })
  const delta = incrementi - riduzioni
  if (![incrementi, riduzioni, delta].every(Number.isSafeInteger) || (totali &&
    (centesimi(totali.incrementi) !== incrementi || centesimi(totali.riduzioni) !== riduzioni || centesimi(totali.delta) !== delta))) throw Error('Totali non coerenti con il dettaglio')
  return { cantiere, righe, totali: { incrementi: incrementi / 100, riduzioni: riduzioni / 100, delta: delta / 100 } }
}

const html = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const euro = (n: number) => `${n >= 0 ? '+' : '-'}${Math.abs(n).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}`
export function documentoAggiornamentiContrattuali(d: DettaglioAggiornamenti): string {
  const righe = d.righe.map(r => `<tr><td>${r.numero}</td><td>${html(r.data)}${r.approvata ? `<small>Approvata: ${html(r.approvata)}</small>` : ''}</td><td>${html(r.variante)}</td><td>${html(r.descrizione)}${r.origine ? `<small>Origine: ${html(r.origine)}</small>` : ''}</td><td>${html(r.tipo)}</td><td class="importo">${html(euro(r.importo))}</td></tr>`).join('')
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Aggiornamenti contrattuali</title><style>@page{size:A4 landscape;margin:14mm}body{font:12px Arial,sans-serif;color:#0f172a}h1{font-size:22px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #cbd5e1;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}th{background:#f1f5f9}thead{display:table-header-group}tr{break-inside:avoid}small{display:block;color:#475569;margin-top:4px}.importo{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}dl{display:grid;grid-template-columns:1fr auto;gap:8px;max-width:440px;margin-left:auto}dd{margin:0;text-align:right}</style></head><body><h1>Aggiornamenti contrattuali</h1>${d.cantiere.trim() ? `<p>Cantiere: <strong>${html(d.cantiere)}</strong></p>` : ''}<table><thead><tr>${['N.', 'Data', 'Variante', 'Lavorazione', 'Tipo', 'Importo'].map(t => `<th>${t}</th>`).join('')}</tr></thead><tbody>${righe}</tbody></table><dl><dt>Totale incrementi</dt><dd>${html(euro(d.totali.incrementi))}</dd><dt>Totale riduzioni</dt><dd>${html(euro(-d.totali.riduzioni))}</dd><dt><strong>Delta aggiornamenti</strong></dt><dd><strong>${html(euro(d.totali.delta))}</strong></dd></dl></body></html>`
}

export async function excelAggiornamentiContrattuali(d: DettaglioAggiornamenti): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx')
  const valori = [
    ['Aggiornamenti contrattuali'], ['Cantiere', d.cantiere], [],
    ['N.', 'Data', 'Approvata il', 'Variante', 'Lavorazione', 'Origine', 'Tipo', 'Importo (€)'],
    ...d.righe.map(r => [r.numero, r.data, r.approvata, r.variante, r.descrizione, r.origine, r.tipo, r.importo]), [],
    ['Totale incrementi', null, null, null, null, null, null, d.totali.incrementi],
    ['Totale riduzioni', null, null, null, null, null, null, -d.totali.riduzioni],
    ['Delta aggiornamenti', null, null, null, null, null, null, d.totali.delta],
  ]
  const fineTabella = 4 + d.righe.length
  const gruppi = new Map<string, { celle: number[]; centesimi: number }>()
  d.righe.forEach((r, i) => {
    if (r.economiaStato !== 'verificata' || r.economiaTipoRiga !== 'materiale') return
    const giorno = r.economiaDataOperativa || 'Data operativa non disponibile'
    const g = gruppi.get(giorno) || { celle: [], centesimi: 0 }
    g.celle.push(i + 5); g.centesimi += centesimi(r.importo); gruppi.set(giorno, g)
  })
  valori.push([], ['Riepilogo materiali per giornata'], ['Data operativa', 'N. righe materiali', 'Subtotale materiali €'])
  const subtotali: { riga: number; celle: number[]; importo: number }[] = []
  for (const [giorno, g] of [...gruppi].sort(([a], [b]) => a.localeCompare(b))) {
    valori.push([giorno === 'Data operativa non disponibile' ? giorno : giorno.split('-').reverse().join('/'), g.celle.length, g.centesimi / 100])
    subtotali.push({ riga: valori.length, celle: g.celle, importo: g.centesimi / 100 })
  }
  const totaleMateriali = subtotali.reduce((n, g) => n + centesimi(g.importo), 0) / 100
  valori.push(['Totale materiali', null, totaleMateriali])
  const rigaTotaleMateriali = valori.length
  const nonVerificate = d.righe.filter(r => r.economiaStato !== 'verificata' && r.economiaStato !== 'non Economia').length
  valori.push(['Righe con origine Economia non verificata', nonVerificate], ['I riepiloghi materiali includono solo origini verificate; le altre righe restano nel totale generale.'], [],
    ['Totale generale', null, null, null, null, null, null, d.totali.delta])
  const foglio = XLSX.utils.aoa_to_sheet(valori)
  const valuta = '+#,##0.00 "€";-#,##0.00 "€";0.00 "€"'
  const formula = (cella: string, f: string, v: number) => { foglio[cella] = { t: 'n', f, v, z: valuta } }
  // Riferimenti alle sole righe principali: i riepiloghi non vengono risommati.
  for (const g of subtotali) {
    // Excel accetta al massimo 255 argomenti per funzione.
    const blocchi: string[] = []
    for (let i = 0; i < g.celle.length; i += 200) blocchi.push('SUM(' + g.celle.slice(i, i + 200).map(r => 'H' + r).join(',') + ')')
    const f = blocchi.length === 1 ? blocchi[0] : 'SUM(' + blocchi.join(',') + ')'
    if (f.length > 8192) throw Error('Riepilogo troppo esteso per una formula Excel')
    formula('C' + g.riga, f, g.importo)
  }
  formula('C' + rigaTotaleMateriali, subtotali.length ? 'SUM(C' + subtotali[0].riga + ':C' + subtotali[subtotali.length - 1].riga + ')' : '0', totaleMateriali)
  formula('H' + valori.length, 'SUM(H5:H' + fineTabella + ')', d.totali.delta)
  formula('H' + (fineTabella + 2), 'SUMIF(H5:H' + fineTabella + ',">0",H5:H' + fineTabella + ')', d.totali.incrementi)
  formula('H' + (fineTabella + 3), 'SUMIF(H5:H' + fineTabella + ',"<0",H5:H' + fineTabella + ')', -d.totali.riduzioni)
  formula('H' + (fineTabella + 4), 'H' + (fineTabella + 2) + '+H' + (fineTabella + 3), d.totali.delta)
  foglio['!cols'] = [6, 15, 15, 28, 58, 45, 18, 20].map(wch => ({ wch }))
  foglio['!autofilter'] = { ref: `A4:H${4 + d.righe.length}` }
  foglio['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }]
  for (let r = 4; r < valori.length; r++) {
    const cella = foglio[XLSX.utils.encode_cell({ r, c: 7 })]
    if (cella?.t === 'n') cella.z = '+#,##0.00 "€";-#,##0.00 "€";0.00 "€"'
  }
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, foglio, 'Aggiornamenti contrattuali')
  const audit = XLSX.utils.aoa_to_sheet([
    ['N. riga principale', 'Stato riconciliazione', 'Tipo Economia', 'Data operativa ISO', 'Registrazione ID', 'Sorgente ID', 'Variante ID', 'Indice snapshot (base 0)', 'Importo sorgente €', 'Operaio ID', 'Materiale ID', 'Percorso identità'],
    ...d.righe.map(r => [r.numero, r.economiaStato, r.economiaTipoRiga || '', r.economiaDataOperativa || '', r.economiaRegistrazioneId || '', r.economiaSorgenteId || '', r.economiaVarianteId || '', r.economiaIndiceVoce ?? null, r.economiaImportoSorgente ?? null, r.economiaOperaioId || '', r.economiaMaterialeId || '', r.economiaPercorso || '']),
  ])
  audit['!cols'] = [12, 38, 16, 18, 38, 38, 38, 20, 20, 38, 38, 26].map(wch => ({ wch }))
  for (let i = 2; i <= d.righe.length + 1; i++) if (audit['I' + i]) audit['I' + i].z = valuta
  XLSX.utils.book_append_sheet(libro, audit, 'Origini Economia')
  return XLSX.write(libro, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

export function nomeFileAggiornamenti(cantiere: string) {
  const nome = cantiere.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80)
  return `aggiornamenti-contrattuali${nome ? '-' + nome : ''}.xlsx`
}
