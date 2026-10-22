type Riga = Record<string, any>
export type LettoreRaccoltaSorgente = { rpc: (nome: string, parametri: Record<string, unknown>) => any }
export type CollegamentoRaccolta = {
  sorgenteId: string; raccoltaId: string; varianteId: string; nome: string; data: string
  revisioneSorgente: number; revisioneCongelata: number; revisioneCorrente: number | null
  statoCorrente: string | null; integrazioniSuccessive: boolean; correnteDisponibile: boolean
  righeCorrenti: { id: string; descrizione: string; quantita: string; um: string; prezzo: string }[]
}
const record = (v: unknown): v is Riga => !!v && typeof v === 'object' && !Array.isArray(v)
const id = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const revisione = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const stop = (): never => { throw Error('Collegamento raccolta Economia non verificabile.') }
export function leggiCollegamentoCongelato(s: Riga, varianteId: string, cantiereId: string): CollegamentoRaccolta {
  const snap = s.snapshot
  if (s.tipo !== 'raccolta_economia' || s.variante_id !== varianteId || !id(s.id) || !id(s.economia_raccolta_id) ||
      s.snapshot_version !== 1 || !record(snap) || snap.raccolta_id !== s.economia_raccolta_id || snap.cantiere_id !== cantiereId ||
      !revisione(s.economia_revisione_sorgente) || !revisione(s.economia_revisione_congelata) ||
      snap.revisione_sorgente !== s.economia_revisione_sorgente || snap.revisione_congelata !== s.economia_revisione_congelata ||
      s.economia_revisione_congelata < s.economia_revisione_sorgente) return stop()
  return { sorgenteId: s.id, raccoltaId: s.economia_raccolta_id, varianteId,
    nome: typeof snap.titolo === 'string' && snap.titolo.trim() ? snap.titolo : typeof s.titolo === 'string' ? s.titolo : 'Raccolta Economia',
    data: typeof snap.data === 'string' ? snap.data : '', revisioneSorgente: s.economia_revisione_sorgente,
    revisioneCongelata: s.economia_revisione_congelata, revisioneCorrente: null, statoCorrente: null,
    integrazioniSuccessive: false, correnteDisponibile: false, righeCorrenti: [] }
}
export async function caricaRaccolteSorgenti(client: LettoreRaccoltaSorgente, sorgenti: readonly Riga[], varianteId: string, cantiereId: string): Promise<CollegamentoRaccolta[]> {
  const elenco: CollegamentoRaccolta[] = [], ids = new Set<string>()
  for (const s of sorgenti) {
    if (s.variante_id !== varianteId) return stop()
    if (s.tipo !== 'raccolta_economia') continue
    const congelato = leggiCollegamentoCongelato(s, varianteId, cantiereId)
    if (ids.has(congelato.raccoltaId)) return stop()
    ids.add(congelato.raccoltaId)
    try {
      const { data, error } = await client.rpc('leggi_raccolta_economia', { p_raccolta_id: congelato.raccoltaId })
      const c = data?.raccolta
      if (error || !record(c) || c.id !== congelato.raccoltaId || c.cantiere_id !== cantiereId || !['bozza','chiusa'].includes(c.stato) ||
          !revisione(c.revisione) || c.revisione < congelato.revisioneCongelata || !Array.isArray(data.righe)) throw Error('Corrente non verificabile')
      const righeIds = new Set<string>()
      const righeCorrenti = data.righe.map((r: Riga) => {
        if (!record(r) || !id(r.id) || righeIds.has(r.id) || r.raccolta_id !== c.id || typeof r.descrizione !== 'string' || typeof r.unita_misura !== 'string') throw Error('Riga corrente non verificabile')
        righeIds.add(r.id)
        const numero = (v: unknown) => (typeof v === 'number' || typeof v === 'string') && String(v).trim() && Number.isFinite(Number(v)) && Number(v) >= 0 ? String(v) : null
        const quantita = numero(r.quantita), prezzo = r.prezzo_unitario === null ? 'Da valorizzare' : numero(r.prezzo_unitario)
        if (quantita === null || prezzo === null) throw Error('Quantità/prezzo non verificabile')
        return { id: r.id, descrizione: r.descrizione, quantita, um: r.unita_misura, prezzo }
      })
      elenco.push({ ...congelato, statoCorrente: c.stato, revisioneCorrente: c.revisione, correnteDisponibile: true,
        integrazioniSuccessive: c.revisione > congelato.revisioneCongelata, righeCorrenti })
    } catch {
      // Il collegamento congelato resta consultabile anche quando il corrente non è leggibile.
      elenco.push(congelato)
    }
  }
  return elenco
}
