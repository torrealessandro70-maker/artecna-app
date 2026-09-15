const messaggioCollegati = 'Il cantiere contiene dati collegati e non può essere eliminato con il comando semplice.'

export async function eliminaCantiereVuoto(db: any, id: string, nome: string, conferma: () => boolean): Promise<boolean> {
  if (!id || !nome) throw new Error('Cantiere non identificato. Ricarica l’elenco.')
  const categorie = new Set<string>()
  const controlla = async (query: any, categoria: string) => {
    const { data, error } = await query.limit(1)
    if (error) throw new Error(`Impossibile verificare ${categoria}: ${error.message}. Nessuna cancellazione eseguita.`)
    if (data?.length) categorie.add(categoria)
  }
  for (const [tabella, categoria] of [
    ['preventivi_cantiere', 'Preventivi'],
    ['preventivo_lavorazioni', 'Lavorazioni preventivo'],
    ['sal_lavorazioni', 'SAL'],
  ]) {
    await controlla(db.from(tabella).select('id').eq('cantiere_id', id), categoria)
    // Preserve protection for legacy rows without a UUID relationship.
    await controlla(db.from(tabella).select('id').is('cantiere_id', null).eq('cantiere', nome), categoria)
  }
  for (const [tabella, categoria] of [
    ['rapportini', 'Rapportini'], ['foto_cantiere', 'Foto'],
    ['timbrature', 'Presenze / timbrature'], ['materiali_cantiere', 'Materiali'],
    ['attrezzi_cantiere', 'Attrezzature'], ['acconti_cantiere', 'Acconti'],
    ['fatture_emesse', 'Fatture emesse'], ['fatture_fornitori_righe', 'Righe fatture fornitori'],
    ['pagamenti_fornitori', 'Pagamenti fornitori'], ['incassi_non_fatturati', 'Incassi non fatturati'],
    ['memoria_prezzi', 'Memoria prezzi'],
  ]) {
    await controlla(db.from(tabella).select('id').eq('cantiere', nome), categoria)
  }
  await controlla(db.from('agenda_attivita').select('id').contains('collegamento', { tipo: 'cantiere', id }), 'Agenda')
  if (categorie.size) throw new Error(`${messaggioCollegati}\n\n${[...categorie].join(', ')}`)
  if (!conferma()) return false
  const { data, error } = await db.from('cantieri').delete().eq('id', id).select('id')
  if (error) throw new Error(error.code === '23503' ? messaggioCollegati : `Errore eliminazione cantiere: ${error.message}`)
  if (!data?.some((row: { id: string }) => row.id === id)) {
    throw new Error('Nessun cantiere eliminato. Verifica disponibilità e permessi e ricarica l’elenco.')
  }
  return true
}
