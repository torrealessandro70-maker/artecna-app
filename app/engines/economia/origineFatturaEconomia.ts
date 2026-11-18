import type { SupabaseClient } from '@supabase/supabase-js'

export type OrigineFatturaEconomia = {
  fatturaId: string; rigaFatturaId: string; quotaId: string
  registrazioneId: string; raccoltaId: string; cantiereId: string
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const nonVerificabile = () => new Error('Non verificabile: collegamenti UUID incompleti o discordanti.')

export function identitaOrigineFattura(r: unknown, raccoltaId: string, cantiereId: string): OrigineFatturaEconomia {
  if (!uuid(raccoltaId) || !uuid(cantiereId) || !record(r) || !uuid(r.id) || r.raccolta_id !== raccoltaId
    || r.origine !== 'fattura_fornitore' || r.tipo_riga !== 'materiale' || !uuid(r.fattura_riga_id)
    || !record(r.dettagli_analitici) || r.dettagli_analitici.version !== 1
    || !record(r.dettagli_analitici.fattura)) throw nonVerificabile()
  const f = r.dettagli_analitici.fattura
  if (f.version !== 1 || !uuid(f.fattura_id) || f.fattura_riga_id !== r.fattura_riga_id) throw nonVerificabile()
  // Per Economia il reader storico usa economia_righe.id come identità della quota.
  return { fatturaId: f.fattura_id, rigaFatturaId: r.fattura_riga_id, quotaId: r.id,
    registrazioneId: r.id, raccoltaId, cantiereId }
}

export async function verificaOrigineFattura(client: Pick<SupabaseClient, 'from' | 'rpc'>, r: unknown,
  raccoltaId: string, cantiereId: string): Promise<OrigineFatturaEconomia> {
  const id = identitaOrigineFattura(r, raccoltaId, cantiereId)
  const { data: riga, error } = await client.from('fatture_fornitori_righe').select('id,fattura_id')
    .eq('id', id.rigaFatturaId).eq('fattura_id', id.fatturaId).maybeSingle()
  if (error || !record(riga) || riga.id !== id.rigaFatturaId || riga.fattura_id !== id.fatturaId)
    throw new Error('Non verificabile: riga fattura non leggibile o non corrispondente.')
  const { data, error: erroreStorico } = await client.rpc('leggi_assegnazioni_materiali_fattura', {
    p_fattura_id: id.fatturaId, p_cantiere_id: cantiereId,
  })
  if (erroreStorico || !Array.isArray(data)) throw new Error('Non verificabile: assegnazioni non leggibili.')
  const righe = data.filter(v => record(v) && v.fattura_riga_id === id.rigaFatturaId)
  if (righe.length !== 1 || !record(righe[0]) || !Array.isArray(righe[0].assegnazioni)) throw nonVerificabile()
  const quote = righe[0].assegnazioni.filter((v: unknown) => record(v) && v.id === id.quotaId)
  if (quote.length !== 1 || !record(quote[0]) || quote[0].destinazione !== 'economia'
    || quote[0].raccolta_id !== raccoltaId || quote[0].cantiere_id !== cantiereId) throw nonVerificabile()
  return id
}
