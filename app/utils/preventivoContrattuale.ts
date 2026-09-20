export async function impostaPreventivoContrattuale(db: any, cantiereId: string, preventivoId: string) {
  if (!cantiereId || !preventivoId) throw new Error('Cantiere o preventivo non identificato.')
  const { data: preventivo, error: erroreVerifica } = await db.from('preventivi_cantiere')
    .select('id, cantiere_id').eq('id', preventivoId).eq('cantiere_id', cantiereId).single()
  if (erroreVerifica || !preventivo || preventivo.cantiere_id !== cantiereId || preventivo.id !== preventivoId) {
    throw new Error('Il preventivo non è disponibile o non appartiene a questo cantiere. Nessuna modifica eseguita.')
  }
  const incompatibile = 'Non puoi cambiare il preventivo contrattuale: il SAL contiene lavorazioni collegate a un altro contratto.'
  let offset = 0
  while (true) {
    const { data: sal, error: erroreSal, count } = await db.from('sal_lavorazioni')
      .select('id, cantiere_id, source_lavorazione_id, source_variante_lavorazione_id', { count: 'exact' })
      .eq('cantiere_id', cantiereId)
      .or('source_lavorazione_id.not.is.null,source_variante_lavorazione_id.not.is.null')
      .order('id', { ascending: true }).range(offset, offset + 199)
    if (erroreSal || !Array.isArray(sal) || !Number.isInteger(count) || count < 0) {
      throw new Error('Impossibile verificare tutte le sorgenti SAL. Nessuna modifica eseguita.')
    }
    if (offset + sal.length > count || (sal.length === 0 && offset < count)) {
      throw new Error('Elenco SAL incompleto o cambiato durante la verifica. Nessuna modifica eseguita.')
    }
    for (const riga of sal) {
      const base = riga.source_lavorazione_id != null
      const variante = riga.source_variante_lavorazione_id != null
      if (riga.cantiere_id !== cantiereId || base === variante) {
        throw new Error('Sorgente SAL incoerente o doppia. Nessuna modifica eseguita.')
      }
      if (base) {
        const { data: sorgente, error: erroreSorgente } = await db.from('preventivo_lavorazioni')
          .select('id, cantiere_id, preventivo_id').eq('id', riga.source_lavorazione_id).maybeSingle()
        if (erroreSorgente || !sorgente || String(sorgente.id) !== String(riga.source_lavorazione_id)) {
          throw new Error('Sorgente base SAL non disponibile o non verificabile. Nessuna modifica eseguita.')
        }
        if (sorgente.cantiere_id !== cantiereId || sorgente.preventivo_id !== preventivoId) {
          throw new Error(incompatibile)
        }
      } else {
        const { data: sorgente, error: erroreSorgente } = await db.from('variante_lavorazioni')
          .select('id, variante_id').eq('id', riga.source_variante_lavorazione_id).maybeSingle()
        if (erroreSorgente || !sorgente || !sorgente.variante_id ||
            String(sorgente.id) !== String(riga.source_variante_lavorazione_id)) {
          throw new Error('Sorgente Variante SAL non disponibile o non verificabile. Nessuna modifica eseguita.')
        }
        const { data: testata, error: erroreTestata } = await db.from('varianti_cantiere')
          .select('id, cantiere_id, preventivo_contrattuale_id, stato').eq('id', sorgente.variante_id).maybeSingle()
        if (erroreTestata || !testata || testata.id !== sorgente.variante_id) {
          throw new Error('Testata Variante SAL non disponibile o non verificabile. Nessuna modifica eseguita.')
        }
        if (testata.cantiere_id !== cantiereId || testata.preventivo_contrattuale_id !== preventivoId) {
          throw new Error(incompatibile)
        }
        if (testata.stato !== 'approvata') {
          throw new Error('Non puoi cambiare il preventivo contrattuale: il SAL contiene una Variante non approvata.')
        }
      }
    }
    offset += sal.length
    if (offset === count) break
  }
  const { data, error } = await db.from('cantieri')
    .update({ preventivo_contrattuale_id: preventivoId }).eq('id', cantiereId)
    .select('id, preventivo_contrattuale_id').single()
  if (error) throw new Error(`Impossibile impostare il preventivo contrattuale: ${error.message}`)
  if (data?.id !== cantiereId || data?.preventivo_contrattuale_id !== preventivoId) {
    throw new Error('Salvataggio non confermato. Ricarica i cantieri prima di riprovare.')
  }
  return data
}
