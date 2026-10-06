import { letturaPortaleValida, type ContestoLetturaRapportinoPortale } from './validaLetturaPortale'
import type { StatoRapportinoV2 } from './contrattoMaterialiRapportino'

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(v, k))
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const decimal6 = (v: unknown): v is string => typeof v === 'string' && /^(0|[1-9][0-9]{0,11})\.[0-9]{6}$/.test(v)
const decimal2 = (v: unknown): v is string => typeof v === 'string' && /^(0|[1-9][0-9]*)\.[0-9]{2}$/.test(v)
const scaled = (s: string) => BigInt(s.replace('.', ''))

/** V1 non viene allentato: la sua validazione rimane autorevole per contesto e prestazioni. */
export function letturaMaterialiValida(v: unknown, contesto: ContestoLetturaRapportinoPortale): v is StatoRapportinoV2 {
  if (!obj(v) || !exact(v, ['versione_lettura','cantiere_id','data','presente','versione_prestazioni','rapportino_id','dettaglio']) || v.versione_lettura !== 2) return false
  if (v.versione_prestazioni !== 1) return letturaPortaleValida({ ...v, versione_lettura: 1 }, contesto)
  const d = v.dettaglio
  if (!obj(d) || !exact(d, ['versione_contratto','rapportino_id','revisione','cantiere_id','data','documento','prestazioni','versione_materiali','materiali','riepilogo_materiali','documento_legacy_materiali'])
    || d.versione_contratto !== 2 || !obj(d.documento) || !exact(d.documento, ['note']) || typeof d.documento.note !== 'string'
    || !obj(d.documento_legacy_materiali) || !exact(d.documento_legacy_materiali, ['materiali','quantita_materiali'])
    || !Object.values(d.documento_legacy_materiali).every(x => typeof x === 'string')
    || (d.versione_materiali !== 0 && d.versione_materiali !== 1) || !Array.isArray(d.materiali)
    || (d.versione_materiali === 0 && d.materiali.length !== 0)) return false
  const legacyView = { ...v, versione_lettura: 1, dettaglio: {
    versione_contratto: 1, rapportino_id: d.rapportino_id, revisione: d.revisione, cantiere_id: d.cantiere_id, data: d.data,
    documento: { note: d.documento.note, ...d.documento_legacy_materiali }, prestazioni: d.prestazioni,
  } }
  if (!letturaPortaleValida(legacyView, contesto)) return false
  const ids = new Set<string>(), keys = new Set<string>()
  let total = BigInt(0), missing = 0
  for (const m of d.materiali) {
    if (!obj(m) || !exact(m, ['materiale_id','chiave_client','descrizione','unita_misura','quantita','costo_unitario','costo_totale','note','revisione','rimossa_at'])
      || !uuid(m.materiale_id) || !uuid(m.chiave_client) || ids.has(m.materiale_id) || keys.has(m.chiave_client)
      || typeof m.descrizione !== 'string' || m.descrizione.trim() !== m.descrizione || m.descrizione.length < 1 || m.descrizione.length > 2000
      || typeof m.unita_misura !== 'string' || m.unita_misura.trim() !== m.unita_misura || m.unita_misura.length < 1 || m.unita_misura.length > 50
      || typeof m.note !== 'string' || m.note.length > 20000 || !integer(m.revisione)
      || !decimal6(m.quantita) || scaled(m.quantita) <= BigInt(0)
      || (m.costo_unitario !== null && !decimal6(m.costo_unitario))
      || (m.costo_unitario === null ? m.costo_totale !== null : !decimal2(m.costo_totale))
      || (m.rimossa_at !== null && (typeof m.rimossa_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(m.rimossa_at) || !Number.isFinite(Date.parse(m.rimossa_at))))) return false
    ids.add(m.materiale_id); keys.add(m.chiave_client)
    if (typeof m.costo_unitario === 'string' && typeof m.costo_totale === 'string') {
      if ((scaled(m.quantita) * scaled(m.costo_unitario) + BigInt(5000000000)) / BigInt(10000000000) !== scaled(m.costo_totale)) return false
    }
    if (m.rimossa_at === null) {
      if (m.costo_unitario === null) missing++
      else total += scaled(m.costo_totale as string)
    }
  }
  const r = d.riepilogo_materiali
  return obj(r) && exact(r, ['totale_materiali_valorizzati','numero_materiali_da_valorizzare','valorizzazione_completa'])
    && decimal2(r.totale_materiali_valorizzati) && scaled(r.totale_materiali_valorizzati) === total
    && integer(r.numero_materiali_da_valorizzare) && r.numero_materiali_da_valorizzare === missing
    && r.valorizzazione_completa === (missing === 0)
}
