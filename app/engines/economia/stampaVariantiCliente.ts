export type VoceCliente = { descrizione: string; um: string; quantita: number; prezzo: number | null; totale: number | null; tipo: 'manodopera' | 'materiale' | 'lavorazione'; data?: string; operaio?: string; testoAttuale?: boolean }
export type VarianteCliente = { id?: string; numero: number | null; titolo: string; data: string; stato: string; totale: number | null; voci: VoceCliente[] }
export type ContestoStampaVarianti = { nome: string; contrattoBase: number | null; preventivoId: string | null }
const pulisci = (v: unknown) => String(v ?? '').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '').trim()
const html = (v: unknown) => pulisci(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const euro = (v: number | null) => v === null ? 'da definire' : v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
export function vociCliente(lavorazioni: readonly Record<string, unknown>[], sorgenti: readonly Record<string, unknown>[], diagnostica?: (fase: string, campi: Record<string, unknown>) => void): VoceCliente[] {
  return lavorazioni.map(l => {
    const economie = sorgenti.filter(s => s.tipo === 'raccolta_economia')
    // Il reader legacy omette gli ID di provenienza. Il writer Economia crea
    // una nuova variante con numero_riga = indice + 1: accetta il collegamento
    // solo con una sorgente unica e contenuto economico interamente coincidente.
    const candidato = economie.length === 1 ? economie[0] : undefined
    const registro = (candidato?.snapshot as { registrazioni?: Record<string, unknown>[] } | undefined)?.registrazioni?.[Number(l.numero_riga) - 1]
    const coincide = registro && Number.isSafeInteger(l.numero_riga) && Number(l.numero_riga) > 0 &&
      registro.descrizione === l.descrizione && registro.unita_misura === l.unita_misura &&
      Number(registro.quantita) === Number(l.quantita_delta) &&
      registro.prezzo_unitario !== null && Number(registro.prezzo_unitario) === Number(l.prezzo_unitario) &&
      Number(registro.importo) === Number(l.delta_contratto)
    const s = sorgenti.find(s => s.id === l.variante_sorgente_id) ?? (coincide ? candidato : undefined)
    const snap = s?.snapshot as { registrazioni?: Record<string, unknown>[] } | undefined
    const indice = s === candidato && l.variante_sorgente_id === undefined ? Number(l.numero_riga) - 1 : l.indice_voce_sorgente
    const r = Array.isArray(snap?.registrazioni) && Number.isSafeInteger(indice) ? snap.registrazioni[Number(indice)] : undefined
    const tipo = r?.tipo_riga === 'materiale' ? 'materiale' : r?.tipo_riga === 'manodopera' ? 'manodopera' : 'lavorazione'
    const n = (v: unknown) => v === null || v === undefined ? null : Number(v)
    const quantita = n(l.quantita_delta), prezzo = n(l.prezzo_unitario), totale = n(l.delta_contratto)
    if (quantita === null || !Number.isFinite(quantita) || (prezzo !== null && !Number.isFinite(prezzo)) || (totale !== null && !Number.isFinite(totale))) throw new Error('Importi stampa non verificabili.')
    const analitici = r?.dettagli_analitici as { rapportino?: Record<string, unknown>; operativo?: Record<string, unknown> } | undefined
    const dettagli = (r?.prestazione_snapshot ?? analitici?.rapportino ?? analitici?.operativo) as Record<string, unknown> | undefined
    const consultazione = r?.consultazione_rapportino as { descrizione?: string; operaio?: string } | undefined
    const descrizioneCorrente = pulisci(consultazione?.descrizione)
    const daRapportino = r?.origine === 'rapportino' || /^Prestazione Rapportino \d{4}-\d{2}-\d{2}$/.test(String(l.descrizione))
    diagnostica?.('associazione', { lavorazione_id: l.id, numero_riga: l.numero_riga, sorgente_id: s?.id ?? null, raccolta_id: s?.economia_raccolta_id ?? null,
      registrazione_id: r?.id ?? null, rapportino_id: dettagli?.rapportino_id ?? null, data: dettagli?.data ?? null,
      sorgente_candidata_id: candidato?.id ?? null, registrazione_candidata_id: registro?.id ?? null,
      rapportino_candidato_id: (registro?.dettagli_analitici as { rapportino?: Record<string, unknown> } | undefined)?.rapportino?.rapportino_id ?? null,
      sorgenti_economia: economie.length, associazione_riuscita: !!r, percorso: l.variante_sorgente_id !== undefined ? 'id_esplicito' : 'legacy_numero_riga',
      numero_riga_valido: Number.isSafeInteger(l.numero_riga), descrizione_coerente: registro?.descrizione === l.descrizione,
      um_coerente: registro?.unita_misura === l.unita_misura, quantita_coerente: Number(registro?.quantita) === Number(l.quantita_delta),
      prezzo_coerente: registro?.prezzo_unitario !== null && Number(registro?.prezzo_unitario) === Number(l.prezzo_unitario),
      importo_coerente: Number(registro?.importo) === Number(l.delta_contratto), descrizione_ingresso: l.descrizione,
      note_associata: consultazione?.descrizione ?? null, descrizione_finale: daRapportino ? descrizioneCorrente || 'Descrizione del Rapportino non disponibile' : pulisci(l.descrizione) })
    return { descrizione: daRapportino ? descrizioneCorrente || 'Descrizione del Rapportino non disponibile' : pulisci(l.descrizione), um: pulisci(l.unita_misura), quantita, prezzo, totale, tipo,
      data: typeof dettagli?.data === 'string' ? dettagli.data : undefined,
      operaio: pulisci(consultazione?.operaio || (analitici?.operativo?.operaio ?? 'Operaio non disponibile')),
      testoAttuale: daRapportino && !!descrizioneCorrente }
  })
}
export function documentoVariantiCliente(ctx: ContestoStampaVarianti, varianti: readonly VarianteCliente[], data = new Date(), opzioni: { includiProposteBozze: boolean } = { includiProposteBozze: false }): string {
  console.info('[ARTECNA stampa ingresso generatore]', { ids: varianti.map(v => v.id ?? null), stati: varianti.map(v => v.stato), includi_proposte_bozze: opzioni.includiProposteBozze })
  // Ultimo confine: il documento riceve esplicitamente la scelta del chiamante.
  varianti = varianti.filter(v => v.stato === 'approvata' || (opzioni.includiProposteBozze && ['proposta', 'bozza'].includes(v.stato)))
  if (ctx.contrattoBase === null || !Number.isFinite(ctx.contrattoBase) || varianti.some(v=>(v.stato === 'approvata' && v.totale === null) || (v.totale !== null && !Number.isFinite(v.totale)))) throw new Error('Riepilogo contrattuale non disponibile.')
  const totaleApprovato = varianti.filter(v => v.stato === 'approvata').reduce((s,v)=>s+(v.totale ?? 0),0)
  const subtotale = (voci: VoceCliente[]) => voci.some(r=>r.totale === null) ? null : voci.reduce((s,r)=>s+(r.totale ?? 0),0)
  const tabella = (voci: VoceCliente[], materiale = false) => `<table><thead><tr><th>${materiale?'Materiale':'Descrizione'}</th><th>U.M.</th><th>Quantità</th><th>Prezzo unitario</th><th>Totale</th></tr></thead><tbody>${voci.map(v=>`<tr><td>${html(v.descrizione)}</td><td>${html(v.um)}</td><td>${v.quantita.toLocaleString('it-IT')}</td><td>${euro(v.prezzo)}</td><td>${euro(v.totale)}</td></tr>`).join('')}</tbody></table>`
  const manodopera = (voci: VoceCliente[]) => '<table><thead><tr><th>Data</th><th>Descrizione lavorazione</th><th>Operaio</th><th>Ore</th><th>Tariffa €/h</th><th>Totale</th></tr></thead><tbody>'+voci.map(v=>'<tr><td>'+html(v.data?.split('-').reverse().join('/') || 'Non disponibile')+'</td><td>'+html(v.descrizione)+(v.testoAttuale?' (testo attuale del Rapportino)':'')+'</td><td>'+html(v.operaio || 'Operaio non disponibile')+'</td><td>'+v.quantita.toLocaleString('it-IT')+'</td><td>'+euro(v.prezzo)+'</td><td>'+euro(v.totale)+'</td></tr>').join('')+'</tbody></table>'
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>ARTECNA — Riepilogo varianti</title><style>@page{size:A4;margin:16mm}body{font:12px Arial,sans-serif;color:#172033;line-height:1.4}h1{font-size:23px}h2{font-size:17px;border-bottom:1px solid #aaa;padding-bottom:6px}h3{font-size:13px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:left}thead{display:table-header-group}tr,.totale,.firme{break-inside:avoid}th:not(:first-child),td:not(:first-child){text-align:right}section{margin:22px 0}.riepilogo{border:1px solid #aaa;padding:14px}.firme{margin-top:35px;display:flex;justify-content:space-between}</style></head><body><h1>ARTECNA</h1><h2>Riepilogo varianti e lavori extra</h2><p>Cantiere / cliente: ${html(ctx.nome)}<br>Data stampa: ${data.toLocaleDateString('it-IT')}<br>Riferimento: contratto del cantiere</p>${varianti.map(v=>`<section><h2>Variante ${v.numero === null?'in bozza':'n. '+v.numero} — ${html(v.titolo)}</h2><p>Data: ${html(v.data.split('-').reverse().join('/'))} · Stato: ${html(v.stato)}</p><h3>Dettaglio lavori in economia — MANODOPERA</h3>${manodopera(v.voci.filter(r=>r.tipo==='manodopera'))}${v.voci.some(r=>r.tipo==='lavorazione')?'<h3>LAVORAZIONI</h3>'+tabella(v.voci.filter(r=>r.tipo==='lavorazione')):''}<h3>MATERIALI IMPIEGATI</h3>${v.voci.some(r=>r.tipo==='materiale')?tabella(v.voci.filter(r=>r.tipo==='materiale'),true):'<p>Nessun materiale acquisito nella variante. Eventuali materiali del Rapportino non sono inclusi in questa consultazione.</p>'}<p class="totale">Manodopera: ${euro(subtotale(v.voci.filter(r=>r.tipo==='manodopera')))}<br>Materiali acquisiti: ${euro(subtotale(v.voci.filter(r=>r.tipo==='materiale')))}<br><strong>Totale variante: ${euro(v.totale)}</strong></p></section>`).join('')}<section class="riepilogo"><p>Contratto iniziale: ${euro(ctx.contrattoBase)}</p><p>Totale varianti approvate: ${euro(totaleApprovato)}</p><strong>Nuovo totale contrattuale: ${euro(ctx.contrattoBase+totaleApprovato)}</strong></section><p>Note: ____________________________________________________________</p><p>Data: __________________</p><div class="firme"><span>Firma committente __________________</span><span>Firma impresa __________________</span></div></body></html>`
}
