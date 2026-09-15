export type LavorazioneImportSal = {
  id: number | string
  descrizione: string
  quantita: number | null
  unita_misura: string | null
  importo_previsto: number
}

export async function caricaLavorazioniPreventivo(db: any, preventivoId: string, cantiereId: string): Promise<LavorazioneImportSal[]> {
  const { data, error } = await db.from('preventivo_lavorazioni')
    .select('id, descrizione, quantita, unita_misura, importo_previsto')
    .eq('preventivo_id', preventivoId).eq('cantiere_id', cantiereId).order('id', { ascending: true })
  if (error) throw error
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
  const { data: preventivo, error: errorePreventivo } = await db.from('preventivi_cantiere')
    .select('id').eq('id', preventivoId).eq('cantiere_id', cantiere.id).single()
  if (errorePreventivo) throw errorePreventivo
  if (!preventivo) throw new Error('Preventivo non disponibile per questo cantiere.')
  const righe = await caricaLavorazioniPreventivo(db, preventivoId, cantiere.id)
  const giaPresenti = await caricaSorgentiGiaNelSal(db, righe)
  const ids = new Set(selezione)
  const nuove = righe.filter((r) => ids.has(String(r.id)) && !giaPresenti.has(String(r.id)))
  if (!nuove.length) return 0
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
