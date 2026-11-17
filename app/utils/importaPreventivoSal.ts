import { importoContrattoPreventivo, type AccordoContrattuale } from '../engines/economia/accordiContrattuali'

export type LavorazioneImportSal = {
  id: number | string
  descrizione: string
  quantita: number | null
  unita_misura: string | null
  importo_previsto: number
  importo_originale?: number
  ribasso_percentuale?: number
}

export async function caricaLavorazioniPreventivo(db: any, preventivoId: string, cantiereId: string): Promise<LavorazioneImportSal[]> {
  const { data, error } = await db.from('preventivo_lavorazioni')
    .select('id, descrizione, quantita, unita_misura, importo_previsto')
    .eq('preventivo_id', preventivoId).eq('cantiere_id', cantiereId).order('id', { ascending: true })
  if (error) throw error
  const { data: p, error: erroreAccordo } = await db.from('preventivi_cantiere')
    .select('id,cantiere_id,importo_totale,accordo_contrattuale').eq('id', preventivoId).eq('cantiere_id', cantiereId).maybeSingle()
  if (erroreAccordo) throw erroreAccordo
  if (p?.accordo_contrattuale) {
    if (importoContrattoPreventivo(p) === null) throw Error('Accordo contrattuale non verificabile')
    const a = p.accordo_contrattuale as AccordoContrattuale
    const { data: candidati, error: erroreSorgenti } = await db.rpc('candidati_accordo_contrattuale', { p_cantiere: cantiereId })
    if (erroreSorgenti) throw erroreSorgenti
    const documento = Array.isArray(candidati) ? candidati.find((d: { id?: string }) => d.id === preventivoId) : null
    if (!documento || documento.accordo?.richiesta !== a.richiesta || !Array.isArray(documento.lavorazioni) ||
        a.righe.length !== documento.lavorazioni.length) throw Error('Conteggio lavorazioni e accordo incoerente')
    return documento.lavorazioni.map((r: LavorazioneImportSal) => {
      const v = a.righe.find(v => String(v.id) === String(r.id))
      if (!v || Number(r.importo_previsto) !== v.importo_previsto || Number(r.quantita) !== v.quantita ||
          r.descrizione !== v.descrizione || r.unita_misura !== v.unita_misura) throw Error('Snapshot lavorazione incoerente')
      return { ...r, importo_previsto: v.importo_contrattuale, importo_originale: v.importo_previsto, ribasso_percentuale: a.ribasso_percentuale }
    })
  }
  return data || []
}

export async function caricaSorgentiGiaNelSal(db: any, righe: LavorazioneImportSal[]): Promise<Set<string>> {
  if (!righe.length) return new Set()
  // Source IDs are globally unique. Also exclude an existing row with inconsistent legacy context.
  const { data, error } = await db.from('sal_lavorazioni').select('source_lavorazione_id')
    .in('source_lavorazione_id', righe.map((r) => r.id))
  if (error) throw error
  return new Set((data || []).map((r: any) => String(r.source_lavorazione_id)))
}

export async function importaLavorazioniSelezionateNelSal(
  db: any, preventivoId: string, cantiere: { id: string; nome: string }, selezione: string[],
): Promise<number> {
  if (!preventivoId || !cantiere.id || !selezione.length) return 0
  const { data: cantiereAttuale, error: erroreCantiere } = await db.from('cantieri')
    .select('id, preventivo_contrattuale_id').eq('id', cantiere.id).maybeSingle()
  if (erroreCantiere) throw new Error('Impossibile verificare il preventivo contrattuale del cantiere: ' + erroreCantiere.message)
  if (!cantiereAttuale || cantiereAttuale.id !== cantiere.id) {
    throw new Error('Cantiere non disponibile. Importazione SAL interrotta.')
  }
  if (!cantiereAttuale.preventivo_contrattuale_id) {
    throw new Error('Prima di importare nel SAL occorre impostare un preventivo contrattuale per il cantiere.')
  }
  if (preventivoId !== cantiereAttuale.preventivo_contrattuale_id) {
    throw new Error('Puoi importare nel SAL solo il preventivo contrattuale del cantiere.')
  }
  const { data: preventivo, error: errorePreventivo } = await db.from('preventivi_cantiere')
    .select('id, cantiere_id, accordo_contrattuale').eq('id', preventivoId).eq('cantiere_id', cantiere.id).maybeSingle()
  if (errorePreventivo) throw new Error('Impossibile verificare il preventivo per questo cantiere: ' + errorePreventivo.message)
  if (!preventivo || preventivo.id !== cantiereAttuale.preventivo_contrattuale_id || preventivo.cantiere_id !== cantiere.id) {
    throw new Error('Preventivo non disponibile per questo cantiere.')
  }
  const righe = await caricaLavorazioniPreventivo(db, preventivoId, cantiere.id)
  const giaPresenti = await caricaSorgentiGiaNelSal(db, righe)
  const ids = new Set(selezione)
  const nuove = righe.filter((r) => ids.has(String(r.id)) && !giaPresenti.has(String(r.id)))
  if (!nuove.length) return 0
  if (preventivo.accordo_contrattuale) {
    const { data, error } = await db.rpc('importa_sal_accordato', {
      p_cantiere: cantiere.id, p_preventivo: preventivoId, p_ids: nuove.map(r => r.id),
    })
    if (error) throw error
    return data
  }
  const { error } = await db.from('sal_lavorazioni').insert(nuove.map((r) => ({
    cantiere_id: cantiere.id,
    cantiere: cantiere.nome,
    source_lavorazione_id: r.id,
    descrizione: r.descrizione,
    importo_previsto: r.importo_previsto,
    percentuale: 0,
    importo_maturato: 0,
    completata: false,
    note: 'Importata da preventivo',
    data_aggiornamento: new Date().toISOString().slice(0, 10),
  })))
  if (error) throw error
  return nuove.length
}
