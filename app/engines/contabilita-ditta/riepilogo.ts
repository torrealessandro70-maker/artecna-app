export const FONTI = ['fatture_emesse', 'fatture_fornitori', 'acconti_cantiere', 'incassi_non_fatturati', 'pagamenti_operai', 'pagamenti_fornitori'] as const
export type Fonte = typeof FONTI[number]
export type Riga = Record<string, unknown>
export type Lettura = { stato: 'caricamento' | 'pronta' | 'parziale' | 'errore'; righe: readonly Riga[]; limite?: string }
export type Fonti = Record<Fonte, Lettura>
export type Periodo = { da: string; a: string }
export type Stato = 'Disponibile' | 'Limitato' | 'Non calcolabile'
export type Dettaglio = { id: string; fonte: Fonte; documento: string; data: string; centesimi: number | null; originale: string; incluso: boolean; motivo: string; iva: string; scadenza: string; url?: string }
export type ContrattoIndicatore = { id: string; nome: string; significato: string; fonte: Fonte | null; importo: string; data: string; formula: string; esclusioni: string; limite: string; ambito: 'periodo' | 'progressivo' | 'riferimento' }
export type Indicatore = ContrattoIndicatore & { stato: Stato; centesimi: number | null; dettagli: Dettaglio[]; avvisi: string[] }

// Contratto consultabile anche dalla UI: nessun indicatore eredita implicitamente
// il significato di un altro archivio o la data della fattura come data incasso.
export const CONTRATTI: readonly ContrattoIndicatore[] = [
  { id: 'emesse', nome: 'Documenti emessi registrati', significato: 'Totali dichiarati dei documenti con data fattura nel periodo; non fatturato netto certificato.', fonte: 'fatture_emesse', importo: 'totale', data: 'data_fattura', formula: 'Somma dei totali documentali ammessi nel periodo.', esclusioni: 'Date/importi/ID invalidi, note di credito e importi negativi non riconciliati.', limite: 'Tipologia fiscale e rettifiche non certificate; nessuna garanzia sulle fatture esterne non importate.', ambito: 'periodo' },
  { id: 'ricevute', nome: 'Documenti ricevuti registrati', significato: 'Totali dichiarati degli acquisti documentati nel periodo, non pagamenti o costi di competenza.', fonte: 'fatture_fornitori', importo: 'importo_totale', data: 'data_fattura', formula: 'Somma dei totali documentali ammessi nel periodo.', esclusioni: 'Date/importi/ID invalidi, note di credito e importi negativi non riconciliati.', limite: 'Origine OCR e base IVA da verificare. Materiali e assegnazioni non vengono aggiunti.', ambito: 'periodo' },
  { id: 'acconti', nome: 'Acconti registrati', significato: 'Incassi datati presenti nel solo archivio acconti Cantiere.', fonte: 'acconti_cantiere', importo: 'importo', data: 'data_incasso', formula: 'Somma importo per data_incasso nel periodo.', esclusioni: 'Movimenti senza data, importo valido o ID; nessuna somma con incassato fatture.', limite: 'Non riconciliati con fatture e incassi non fatturati; subtotale della sola fonte caricata.', ambito: 'periodo' },
  { id: 'non-fatturati', nome: 'Incassi non fatturati registrati', significato: 'Movimenti datati del solo archivio incassi non fatturati.', fonte: 'incassi_non_fatturati', importo: 'importo', data: 'data_incasso', formula: 'Somma importo per data_incasso nel periodo.', esclusioni: 'Movimenti senza data, importo valido o ID.', limite: 'Possibile sovrapposizione con acconti e cumulativi fatture: non consolidare.', ambito: 'periodo' },
  { id: 'operai', nome: 'Pagamenti operai registrati', significato: 'Uscite datate, non maturato delle presenze o contributi.', fonte: 'pagamenti_operai', importo: 'importo', data: 'data_pagamento', formula: 'Somma importo per data_pagamento nel periodo.', esclusioni: 'Dati invalidi; nessun costo Rapportino o timbratura aggiunto.', limite: 'Subtotale dei movimenti caricati, non costo completo del lavoro.', ambito: 'periodo' },
  { id: 'cumulativo', nome: 'Incassato cumulativo dichiarato sulle fatture', significato: 'Fotografia corrente su tutte le fatture caricate, indipendente dal periodo selezionato.', fonte: 'fatture_emesse', importo: 'importo_incassato', data: 'Nessuna data movimento disponibile', formula: 'Somma dei cumulativi validi; non attribuita al mese della fattura.', esclusioni: 'Cumulativi invalidi o superiori al totale, note di credito, ID ambigui.', limite: 'Non è un movimento datato né uno storico alla data di riferimento; non consolidato con altri incassi.', ambito: 'progressivo' },
  { id: 'incassi', nome: 'Incassi consolidati nel periodo', significato: 'Totale finanziario senza sovrapposizioni fra archivi.', fonte: null, importo: 'Movimenti riconciliati', data: 'Data effettiva incasso', formula: 'Non eseguita: manca riconciliazione fra le fonti.', esclusioni: 'Cumulativi, fatturato e SAL non sono movimenti.', limite: 'Mancano collegamenti affidabili fra acconti, incassi non fatturati e fatture.', ambito: 'periodo' },
  { id: 'pagato-fornitori', nome: 'Pagamenti fornitori nel periodo', significato: 'Uscite effettive per fornitori.', fonte: 'pagamenti_fornitori', importo: 'Movimenti pagamento', data: 'Data effettiva pagamento non certificata', formula: 'Non eseguita: archivio cumulativo con contratto campi incoerente.', esclusioni: 'Fatture e data_scadenza non sono pagamenti.', limite: 'Il modello corrente non espone eventi datati e collegati affidabili. I record sono consultabili, non sommati.', ambito: 'periodo' },
  { id: 'residui', nome: 'Residui alla data di riferimento', significato: 'Crediti e debiti ricostruiti alla fine del periodo.', fonte: null, importo: 'Documento meno allocazioni verificate entro la data', data: 'Fine periodo', formula: 'Non eseguita nel lettore attuale: mancano allocazioni e storico completo.', esclusioni: 'Non sottrarre acconti Cantiere né usare saldi correnti al posto di storici.', limite: 'Storico non ricostruibile: nessun residuo stimato visualizzato.', ambito: 'riferimento' },
  { id: 'scaduti', nome: 'Scaduti alla data di riferimento', significato: 'Residui con scadenza documentata e attendibile.', fonte: null, importo: 'Residui verificati', data: 'Scadenza certificata', formula: 'Non eseguita: manca scadenzario riconciliato.', esclusioni: 'Nessuna data derivata dalle note o sostituita con data fattura.', limite: 'Scadenze mancanti/non certificate e rate non ricostruibili.', ambito: 'riferimento' },
]

export const testo = (v: unknown): string => typeof v === 'string' || typeof v === 'number' ? String(v) : ''
export function centesimi(v: unknown): number | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const m = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(String(v).trim())
  if (!m) return null
  const decimali = (m[3] || '').replace(/0+$/, '')
  if (decimali.length > 2) return null
  const n = Number(m[2]) * 100 + Number(decimali.padEnd(2, '0'))
  return Number.isSafeInteger(n) ? (m[1] === '-' ? -n : n) : null
}
export function dataValida(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(v + 'T12:00:00Z')
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v
}
export function periodoPreset(tipo: 'mese' | 'trimestre' | 'anno', riferimento: string): Periodo {
  if (!dataValida(riferimento)) throw Error('Data di riferimento non valida')
  const anno = Number(riferimento.slice(0, 4)), mese = Number(riferimento.slice(5, 7))
  const inizio = tipo === 'anno' ? 1 : tipo === 'trimestre' ? Math.floor((mese - 1) / 3) * 3 + 1 : mese
  const fine = inizio + (tipo === 'anno' ? 12 : tipo === 'trimestre' ? 3 : 1)
  return { da: `${anno}-${String(inizio).padStart(2, '0')}-01`, a: new Date(Date.UTC(anno, fine - 1, 0, 12)).toISOString().slice(0, 10) }
}
export function fontiInCaricamento(): Fonti {
  const vuota = (): Lettura => ({ stato: 'caricamento', righe: [] })
  return { fatture_emesse: vuota(), fatture_fornitori: vuota(), acconti_cantiere: vuota(), incassi_non_fatturati: vuota(), pagamenti_operai: vuota(), pagamenti_fornitori: vuota() }
}

function dettaglio(r: Riga, fonte: Fonte, campo: string, data: string, posizione: number): Dettaglio {
  const tipo = testo(r.tipo_documento).toUpperCase()
  const credito = ['TD04', 'TD08', 'NOTA_CREDITO', 'NOTA DI CREDITO'].includes(tipo)
  const n = centesimi(r[campo])
  const cumulativo = campo === 'importo_incassato'
  const totale = centesimi(r.totale)
  const motivo = !testo(r.id) ? 'ID mancante' : n === null ? 'Importo mancante o non verificabile' : credito ? 'Nota di credito: esclusa dai documenti ordinari; consultare le rettifiche fornitori' : n < 0 ? 'Importo negativo: segno/origine da verificare' : cumulativo && (totale === null || n > totale) ? 'Cumulativo non coerente con il totale documento' : ''
  const url = testo(r.xml_url || r.pdf_url)
  return { id: testo(r.id) || `senza-id-${posizione}`, fonte, documento: [testo(r.numero_fattura), testo(r.cliente || r.fornitore || r.operaio_nome || r.descrizione)].filter(Boolean).join(' — ') || testo(r.id) || 'Record senza riferimento', data: testo(r[data]), centesimi: n, originale: testo(r[campo]), incluso: !motivo, motivo,
    iva: ('iva' in r) ? `IVA da verificare — dato originale: ${testo(r.iva) || 'mancante'}` : 'IVA monetaria non certificata',
    scadenza: dataValida(r.data_scadenza) ? `Scadenza non certificata: ${r.data_scadenza}` : 'Scadenza mancante',
    ...(url.startsWith('https://') ? { url } : {}) }
}

export function costruisciRiepilogo(fonti: Fonti, periodo: Periodo): Indicatore[] {
  const periodoOK = dataValida(periodo.da) && dataValida(periodo.a) && periodo.da <= periodo.a
  return CONTRATTI.map(c => {
    const lettura = c.fonte ? fonti[c.fonte] : null
    const bloccato = ['incassi', 'pagato-fornitori', 'residui', 'scaduti'].includes(c.id)
    const tutti = c.fonte && lettura ? lettura.righe.map((r, i) => dettaglio(r, c.fonte!, c.importo, c.data, i)) : []
    // I pagamenti fornitori sono mostrati soltanto come record da riconciliare.
    if (c.id === 'pagato-fornitori' && lettura) tutti.splice(0, tutti.length, ...lettura.righe.map((r, i) => ({ ...dettaglio(r, 'pagamenti_fornitori', 'importo_pagato', 'data_documento', i), incluso: false, motivo: 'Cumulativo non datato: nessuna attribuzione al periodo' })))
    const avvisi: string[] = []
    const ids = new Map<string, Dettaglio[]>()
    for (const r of tutti) { const a = ids.get(r.id) || []; a.push(r); ids.set(r.id, a) }
    // Identità ripetute non vengono sommate né risolte scegliendo una versione arbitraria.
    for (const [id, duplicati] of ids) if (duplicati.length > 1) { avvisi.push(`Identità duplicata ${id}: esclusa, rileggere la fonte`); duplicati.forEach(r => { r.incluso = false; r.motivo = 'Identità ripetuta nella fonte' }) }
    const sospetti = new Set<string>()
    if (c.id === 'emesse' || c.id === 'ricevute') {
      for (const r of tutti) {
        const key = JSON.stringify([r.documento, r.data, r.originale])
        if (sospetti.has(key)) avvisi.push('Documenti con riferimenti simili: sospetto da verificare, nessuna deduplicazione automatica')
        sospetti.add(key)
      }
    }
    const dettagli = tutti.filter(r => {
      if (bloccato || c.ambito === 'progressivo') return true
      if (!dataValida(r.data)) { r.incluso = false; r.motivo = [r.motivo, 'Data mancante o non valida: nessun periodo inventato'].filter(Boolean).join('; '); return true }
      return r.data >= periodo.da && r.data <= periodo.a
    })
    let totale = 0
    for (const r of dettagli) if (r.incluso && r.centesimi !== null) totale += r.centesimi
    const esclusi = dettagli.filter(r => !r.incluso).length
    if (esclusi) avvisi.push(`${esclusi} record esclusi/non attribuibili: vedi dettaglio`)
    if (lettura?.limite) avvisi.push(lettura.limite)
    if (!periodoOK) avvisi.push('Intervallo non valido: correggi le date')
    const nonCaricata = lettura?.stato === 'caricamento' || lettura?.stato === 'errore'
    const parzialeVuota = lettura?.stato === 'parziale' && !lettura.righe.length
    const nonCalcolabile = bloccato || !periodoOK || nonCaricata || parzialeVuota || (esclusi > 0 && dettagli.every(r => !r.incluso)) || !Number.isSafeInteger(totale)
    if (nonCaricata) avvisi.push(lettura?.stato === 'caricamento' ? 'Fonte in caricamento, non è un archivio vuoto' : 'Fonte non disponibile/non autorizzata, nessuno zero sostitutivo')
    const limitato = ['emesse', 'ricevute', 'cumulativo'].includes(c.id) || lettura?.stato === 'parziale' || !!avvisi.length
    return { ...c, stato: nonCalcolabile ? 'Non calcolabile' : limitato ? 'Limitato' : 'Disponibile', centesimi: nonCalcolabile ? null : totale, dettagli, avvisi }
  })
}

/** Solo un DTO di lettura certificato può attestare allocazioni complete.
 * Nessun adapter corrente costruisce questo DTO dai cumulativi legacy.
 * Non è una tabella, un flag DB né una nuova sorgente finanziaria persistente. */
export function residuoRiconciliato(documento: { totale: unknown; data: string }, movimenti: readonly { id: string; importoAllocato: unknown; data: string }[], coperturaCompleta: boolean, riferimento: string): number | null {
  if (!coperturaCompleta || !dataValida(riferimento) || !dataValida(documento.data) || documento.data > riferimento) return null
  const totale = centesimi(documento.totale), ids = new Set<string>()
  if (totale === null || totale < 0) return null
  let allocato = 0
  for (const m of movimenti) {
    const n = centesimi(m.importoAllocato)
    if (!m.id || ids.has(m.id) || !dataValida(m.data) || n === null || n < 0) return null
    ids.add(m.id)
    if (m.data <= riferimento) allocato += n
  }
  return Number.isSafeInteger(allocato) && allocato <= totale ? totale - allocato : null
}
