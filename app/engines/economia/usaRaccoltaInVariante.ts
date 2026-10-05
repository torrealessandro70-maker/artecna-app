type RpcResult = { data: unknown; error: { code?: string } | null }
export type RpcPonteEconomia = (nome: string, parametri: Record<string, unknown>) => PromiseLike<RpcResult>
export type RaccoltaPonteEconomia = { id: string; numero: number; revisione: number; stato: string }
export type EsitoPonteEconomia = {
  variante_id: string; variante_sorgente_id: string; raccolta_id: string
  numero_variante: number | null; stato_variante: string
  numero_lavorazioni: number; totale: number; riutilizzata: boolean
}
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export function raccoltaPonteValida(r: RaccoltaPonteEconomia): boolean {
  return uuid(r.id) && Number.isSafeInteger(r.revisione) && r.revisione >= 0 && ['bozza', 'chiusa'].includes(r.stato)
}
export function errorePonteEconomia(code?: string): string {
  return ({ '22023': 'Raccolta non utilizzabile. Verifica i dati.', '42501': 'Operazione non autorizzata.',
    PT409: 'La Raccolta è cambiata. Aggiorna i dati e riprova.', XX001: 'Dati incoerenti. Non procedere e richiedi una verifica.' } as Record<string, string>)[code ?? '']
    ?? 'Impossibile creare la Variante.'
}
export async function usaRaccoltaInVariante(rpc: RpcPonteEconomia, raccolta: RaccoltaPonteEconomia): Promise<EsitoPonteEconomia> {
  if (!raccoltaPonteValida(raccolta)) throw new Error(errorePonteEconomia('22023'))
  const { data, error } = await rpc('usa_raccolta_economia_in_variante', {
    p_raccolta_id: raccolta.id, p_revisione_attesa: raccolta.revisione,
  })
  if (error) throw new Error(errorePonteEconomia(error.code))
  if (!record(data) || data.versione_contratto !== 1 || data.raccolta_id !== raccolta.id ||
      !uuid(data.variante_id) || !uuid(data.variante_sorgente_id) || typeof data.riutilizzata !== 'boolean' ||
      !['bozza', 'proposta', 'approvata', 'rifiutata', 'annullata'].includes(String(data.stato_variante)) ||
      (data.numero_variante !== null && (!Number.isSafeInteger(data.numero_variante) || Number(data.numero_variante) <= 0)) ||
      (data.stato_variante === 'bozza' && data.numero_variante !== null) ||
      (['proposta', 'approvata', 'rifiutata'].includes(String(data.stato_variante)) && data.numero_variante === null) ||
      !Number.isSafeInteger(data.numero_lavorazioni) || Number(data.numero_lavorazioni) <= 0 ||
      typeof data.totale !== 'number' || !Number.isFinite(data.totale) || data.totale <= 0)
    throw new Error(errorePonteEconomia())
  return data as unknown as EsitoPonteEconomia
}

// Le letture storiche di elenco non espongono economia_raccolta_id.
// Il dettaglio sorgente restituisce la riga completa, comprese le colonne additive.
export async function leggiVarianteDellaRaccolta(rpc: RpcPonteEconomia, raccoltaId: string, varianti: readonly string[]): Promise<string | null> {
  let collegata: string | null = null
  for (const varianteId of varianti) {
      const { data, error } = await rpc('leggi_sorgenti_variante', { p_variante_id: varianteId })
      if (error || !Array.isArray(data)) throw new Error('Collegamento non verificabile.')
      // Questa lettura usa un'unica risposta completa (il chiamante gestisce la paginazione).
      for (const sorgente of data) {
        if (!record(sorgente) || !uuid(sorgente.id) || sorgente.variante_id !== varianteId) throw new Error('Collegamento non verificabile.')
        if (sorgente.tipo !== 'raccolta_economia') continue
        const dettaglio = await rpc('leggi_sorgente_variante', { p_sorgente_id: sorgente.id })
        const riga = Array.isArray(dettaglio.data) ? dettaglio.data.length === 1 ? dettaglio.data[0] : null : dettaglio.data
        if (dettaglio.error || !record(riga) || riga.id !== sorgente.id ||
            riga.variante_id !== varianteId || riga.tipo !== 'raccolta_economia' ||
            !uuid(riga.economia_raccolta_id)) throw new Error('Collegamento non verificabile.')
        if (riga.economia_raccolta_id === raccoltaId) {
          if (collegata !== null) throw new Error('Collegamento non verificabile.')
          collegata = varianteId
        }
      }
  }
  return collegata
}
