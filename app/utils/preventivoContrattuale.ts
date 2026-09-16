export async function impostaPreventivoContrattuale(db: any, cantiereId: string, preventivoId: string) {
  if (!cantiereId || !preventivoId) throw new Error('Cantiere o preventivo non identificato.')
  const { data: preventivo, error: erroreVerifica } = await db.from('preventivi_cantiere')
    .select('id, cantiere_id').eq('id', preventivoId).eq('cantiere_id', cantiereId).single()
  if (erroreVerifica || !preventivo || preventivo.cantiere_id !== cantiereId || preventivo.id !== preventivoId) {
    throw new Error('Il preventivo non è disponibile o non appartiene a questo cantiere. Nessuna modifica eseguita.')
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
