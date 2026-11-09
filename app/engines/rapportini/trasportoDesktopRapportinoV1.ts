import type { TrasportoRapportinoV1 } from './trasportoRapportinoV1'
import { validaRispostaVariantiBozza } from './variantiBozzaV1'

type Sessione = { access_token: string }
type ErroreRpc = { code?: string; message?: string }
type PaginaVarianti = PromiseLike<{ data: unknown; error: ErroreRpc | null }> & {
  order: (column: string, options: { ascending: boolean; nullsFirst?: boolean }) => PaginaVarianti
  range: (from: number, to: number) => PaginaVarianti
}
export type ClientRapportinoDesktop = {
  auth: { getSession: () => Promise<{ data: { session: Sessione | null }; error?: unknown }> }
  rpc: (name: string, args: Record<string, unknown>) => PaginaVarianti
}
const risposta = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
})
function statoErrore(error: ErroreRpc) {
  return error.code === 'P2020' || error.code === 'PGRST301' ? 401
    : ['42501', 'P2021'].includes(error.code || '') ? 403
      : ['PR409', 'PR412'].includes(error.code || '') ? 409 : 503
}

/** Browser adapter: RPCs retain the current user's JWT; never a portal identity. */
export function creaTrasportoDesktopRapportinoV1(client: ClientRapportinoDesktop,
  fetcher: typeof fetch = fetch): TrasportoRapportinoV1 {
  const token = async () => {
    const { data, error } = await client.auth.getSession()
    return !error && data.session?.access_token ? data.session.access_token : null
  }
  const leggi: TrasportoRapportinoV1['leggiStato'] = async (input, signal) => {
    if (!await token()) return risposta({ error: 'Autenticazione obbligatoria' }, 401)
    if (signal?.aborted) throw new DOMException('Lettura annullata', 'AbortError')
    const { data, error } = await client.rpc('leggi_rapportino_desktop', {
      p_cantiere_id: input.cantiere_id, p_data: input.data,
      p_rapportino_id: input.rapportino_id ?? null, p_versione_lettura: 2,
    })
    if (signal?.aborted) throw new DOMException('Lettura annullata', 'AbortError')
    return error ? risposta({ error: 'Lettura Rapportino non disponibile' }, statoErrore(error)) : risposta(data)
  }
  return {
    leggiStato: leggi, leggiStatoV2: leggi,
    async caricaVarianti(cantiereId) {
      if (!await token()) return risposta({ error: 'Autenticazione obbligatoria' }, 401)
      const righe: unknown[] = [], ids = new Set<string>()
      // Same authenticated RPC used by the Desktop SAL/Varianti panels; no new SQL.
      for (let offset = 0; ; offset += 200) {
        const { data, error } = await client.rpc('leggi_varianti_cantiere', { p_cantiere_id: cantiereId })
          .order('numero', { ascending: true, nullsFirst: false }).order('id', { ascending: true }).range(offset, offset + 199)
        if (error) return risposta({ error: 'Varianti non disponibili' }, statoErrore(error))
        if (!Array.isArray(data)) throw new Error('Varianti incomplete')
        for (const v of data) {
          if (!v || v.cantiere_id !== cantiereId || typeof v.id !== 'string' || ids.has(v.id)
            || typeof v.titolo !== 'string' || typeof v.stato !== 'string') throw new Error('Contesto varianti incoerente')
          ids.add(v.id)
          righe.push({ id: v.id, numero: v.numero, etichetta: v.titolo,
            selezionabile: v.stato === 'bozza' || v.stato === 'proposta' })
        }
        if (data.length < 200) break
      }
      return risposta({ varianti: validaRispostaVariantiBozza({ varianti: righe }) })
    },
    async salvaStrutturato(corpo, signal) {
      const bearer = await token()
      if (!bearer) return risposta({ error: 'Autenticazione obbligatoria' }, 401)
      return fetcher('/api/rapportino/strutturato', { method: 'POST', credentials: 'omit',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` }, body: corpo, signal })
    },
  }
}
