export function messaggioEliminazione(error: { code?: string; message?: string }, entita: string) {
  return error.code === '23503'
    ? `${entita}: eliminazione bloccata perché il record è utilizzato da lavorazioni o dallo stato SAL. Nessun file è stato eliminato.`
    : `Errore eliminazione ${entita}: ${error.message || 'operazione non riuscita'}`
}

export async function eliminaFilePreventivi(supabase: any, paths: string[]): Promise<string | null> {
  const files = [...new Set(paths.filter(Boolean))]
  if (!files.length) return null
  try {
    const { error } = await supabase.storage.from('preventivi').remove(files)
    if (error) throw error
    return null
  } catch (error: any) {
    return `Record eliminati dal database, ma pulizia Storage non completata: ${error?.message || 'errore di rete'}. File da ripulire: ${files.join(', ')}`
  }
}

export async function eliminaPreventivoConFile(supabase: any, id: string): Promise<string | null> {
  if (!id) throw new Error('Preventivo non identificato.')
  const { data, error } = await supabase.from('preventivi_cantiere')
    .delete().eq('id', id).select('id, file_path')
  if (error) throw new Error(messaggioEliminazione(error, 'Preventivo'))
  if (!data?.length) throw new Error('Nessun preventivo eliminato. Verifica disponibilità e permessi; file non cancellati.')
  return eliminaFilePreventivi(supabase, data.map((row: any) => row.file_path))
}
