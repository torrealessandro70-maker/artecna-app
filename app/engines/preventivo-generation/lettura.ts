import { leggiOsservatore } from '../variante-fonti/contratto'
import type { SnapshotIntegrativo, VoceContrattuale } from './contesto'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export function leggiSnapshotIntegrativo(data: unknown, varianteId: string): SnapshotIntegrativo {
  if (!obj(data) || !obj(data.contratto) || !obj(data.genealogia) || typeof data.firma !== 'string' || !/^[0-9a-f]{64}$/.test(data.firma)) throw Error('Contesto integrativo non valido')
  const g = data.genealogia
  if (g.variante_id !== varianteId || !uuid.test(String(g.cantiere_id)) || !uuid.test(String(g.preventivo_contrattuale_id)) ||
    (g.sopralluogo_origine_id !== null && !uuid.test(String(g.sopralluogo_origine_id))) || data.contratto.id !== g.preventivo_contrattuale_id || !Array.isArray(data.contratto.voci)) throw Error('Genealogia non valida')
  const voci: VoceContrattuale[] = data.contratto.voci.map(v => {
    if (!obj(v) || typeof v.id !== 'string' || !/^[1-9][0-9]*$/.test(v.id) || typeof v.descrizione !== 'string' || typeof v.unita_misura !== 'string' ||
      !['quantita','prezzo_unitario'].every(k => typeof v[k] === 'number' && Number.isFinite(v[k]) && Number(v[k]) >= 0) ||
      (v.quantita_riducibile !== null && (typeof v.quantita_riducibile !== 'number' || !Number.isFinite(v.quantita_riducibile) || v.quantita_riducibile < 0))) throw Error('Voce contrattuale non valida')
    return v as VoceContrattuale
  })
  if (voci.length > 1000 || new Set(voci.map(v => v.id)).size !== voci.length) throw Error('Contratto troppo grande o duplicato')
  const lettura = leggiOsservatore(data.lettura, varianteId)
  if (data.documento_confermato != null && !uuid.test(String(data.documento_confermato))) throw Error('Documento confermato non valido')
  if (data.lavorazioni_presenti != null && (!Number.isSafeInteger(data.lavorazioni_presenti) || Number(data.lavorazioni_presenti) < 0)) throw Error('Conteggio lavorazioni non valido')
  if (lettura.fonti.cantiere_id !== g.cantiere_id) throw Error('Cantiere non coerente')
  return { lettura, contratto: { id: String(data.contratto.id), voci }, firma: data.firma, documento_confermato: data.documento_confermato as string | null | undefined,
    lavorazioni_presenti: data.lavorazioni_presenti as number | undefined,
    genealogia: { cantiere_id: String(g.cantiere_id), variante_id: varianteId,
      preventivo_contrattuale_id: String(g.preventivo_contrattuale_id), sopralluogo_origine_id: g.sopralluogo_origine_id as string | null } }
}
