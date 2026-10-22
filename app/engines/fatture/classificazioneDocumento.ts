import type { SupabaseClient } from '@supabase/supabase-js'

export type RigaDocumentoFattura = {
  id?: string | null
  categoria_economica?: string | null
  cantiere?: string | null
}
type PayloadRiga = { id: string; categoria_economica: string | null; cantiere: string | null }
type EsitoDocumento = {
  fattura_id: string; richiesta_id: string; costi_legacy_creati: number
  righe: (PayloadRiga & { spesa_legacy_id: string | null })[]
}
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const categorie = ['materiale_cantiere', 'attrezzo_ditta', 'magazzino', 'spesa_generale', 'storno_escluso']

export function payloadClassificazione(righe: RigaDocumentoFattura[]): PayloadRiga[] {
  if (!righe.length || righe.length > 2000) throw Error('Righe documento non valide')
  const payload = righe.map(r => {
    if (!uuid(r.id) || (r.categoria_economica != null && typeof r.categoria_economica !== 'string')
      || (r.cantiere != null && typeof r.cantiere !== 'string')) throw Error('Campi documento non validi')
    const categoria = r.categoria_economica || null, cantiere = r.cantiere || null
    if ((categoria !== null && !categorie.includes(categoria)) || (cantiere !== null && (cantiere.length > 500 || /[\x00-\x1f\x7f]/.test(cantiere)))) throw Error('Classificazione documento non valida')
    return { id: r.id, categoria_economica: categoria, cantiere }
  }).sort((a, b) => a.id.localeCompare(b.id))
  if (new Set(payload.map(r => r.id)).size !== payload.length) throw Error('Righe documento duplicate')
  return payload
}

// Un solo tentativo in volo. Dopo un errore, un esplicito reinvio dello stesso
// payload riusa l'UUID; dopo successo o modifica del payload nasce un nuovo intento.
export function creaSalvataggioDocumento(client: Pick<SupabaseClient, 'rpc'>, nuovaRichiesta = () => crypto.randomUUID()) {
  let tentativo: { firma: string; id: string } | null = null
  let inCorso: Promise<EsitoDocumento> | null = null
  return {
    salva(fatturaId: string, righe: RigaDocumentoFattura[]): Promise<EsitoDocumento> {
      if (!uuid(fatturaId)) throw Error('Fattura non valida')
      const payload = payloadClassificazione(righe), firma = JSON.stringify([fatturaId, payload])
      if (inCorso) return tentativo?.firma === firma ? inCorso : Promise.reject(Error('Salvataggio documentale già in corso'))
      if (tentativo?.firma !== firma) tentativo = { firma, id: nuovaRichiesta() }
      const richiestaId = tentativo.id
      if (!uuid(richiestaId)) throw Error('Richiesta documentale non valida')
      inCorso = (async () => {
        const { data, error } = await client.rpc('salva_classificazione_fattura', {
          p_fattura_id: fatturaId, p_righe: payload, p_richiesta_id: richiestaId,
        })
        if (error) {
          const campo = (k: string) => typeof error[k as keyof typeof error] === 'string' ? error[k as keyof typeof error] : null
          throw Object.assign(Error(error.message || 'Salvataggio documentale non riuscito'), {
            diagnosticaRpc: { code: campo('code'), message: campo('message'), details: campo('details'), hint: campo('hint') },
          })
        }
        if (!record(data) || data.fattura_id !== fatturaId || data.richiesta_id !== richiestaId
          || !Number.isInteger(data.costi_legacy_creati) || Number(data.costi_legacy_creati) < 0 || Number(data.costi_legacy_creati) > payload.length
          || !Array.isArray(data.righe) || data.righe.length !== payload.length
          || new Set(data.righe.map(r => record(r) ? r.id : undefined)).size !== payload.length
          || data.righe.some(r => {
            if (!record(r)) return true
            const attesa = payload.find(p => p.id === r.id)
            return !attesa || r.categoria_economica !== attesa.categoria_economica || r.cantiere !== attesa.cantiere
              || (r.spesa_legacy_id !== null && !uuid(r.spesa_legacy_id))
          })) throw Error('Esito documentale non verificabile: rileggere il documento. Nessun retry automatico.')
        tentativo = null
        return data as EsitoDocumento
      })().finally(() => { inCorso = null })
      return inCorso
    },
  }
}
