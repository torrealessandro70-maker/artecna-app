import { creaBozzaRapportinoV1, ricostruisciBozzaRapportinoV1, type BozzaRapportinoV1 } from './bozzaRapportinoV1'
import type { DettaglioRapportinoV2, MaterialeRapportinoV1, RiepilogoMaterialiRapportinoV1 } from './contrattoMaterialiRapportino'
import type { EsitoSalvataggioRapportino } from './contrattoServizio'

export type MaterialeBozzaV1 = {
  materiale_id: string | null; chiave_client: string; descrizione: string; unita_misura: string
  quantita: string; costo_unitario: string | null; note: string
}
export type SezioneMaterialiBozza = Readonly<{
  versione_materiali: 0 | 1
  baseline: readonly MaterialeRapportinoV1[]
  righe: readonly MaterialeBozzaV1[]
  documento_legacy_materiali: DettaglioRapportinoV2['documento_legacy_materiali']
}>
const uuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s)
/** Solo separatore decimale: niente migliaia, esponenti o arrotondamento implicito. */
export function decimaleMateriale(input: string, positivo = false): string {
  const s = input.trim()
  if (!/^[0-9]+(?:[.,][0-9]{1,6})?$/.test(s)) throw new Error('Decimale materiale non valido')
  const [intero, frazione = ''] = s.replace(',', '.').split('.')
  const i = intero.replace(/^0+(?=\d)/, '')
  if (i.length > 12) throw new Error('Decimale materiale fuori intervallo')
  const value = i + '.' + frazione.padEnd(6, '0')
  if (positivo && BigInt(value.replace('.', '')) === BigInt(0)) throw new Error('Quantità non positiva')
  return value
}
export function costoMateriale(input: string | null): string | null {
  return input === null || input.trim() === '' ? null : decimaleMateriale(input)
}
const centesimi = (q: string, c: string) =>
  (BigInt(q.replace('.', '')) * BigInt(c.replace('.', '')) + BigInt(5000000000)) / BigInt(10000000000)
const euro = (c: bigint) => (c / BigInt(100)).toString() + '.' + (c % BigInt(100)).toString().padStart(2, '0')
export function totaleRigaMateriale(q: string, c: string | null): string | null {
  const quantita = decimaleMateriale(q, true), costo = costoMateriale(c)
  return costo === null ? null : euro(centesimi(quantita, costo))
}
export function riepilogoMaterialiBozza(bozza: BozzaRapportinoV1): RiepilogoMaterialiRapportinoV1 {
  let totale = BigInt(0), mancanti = 0
  for (const r of bozza.materialiStrutturati?.righe || []) {
    const q = decimaleMateriale(r.quantita, true), c = costoMateriale(r.costo_unitario)
    if (c === null) mancanti++; else totale += centesimi(q, c)
  }
  return { totale_materiali_valorizzati: euro(totale), numero_materiali_da_valorizzare: mancanti, valorizzazione_completa: mancanti === 0 }
}
/** Vista prestazioni/documento per riusare integralmente il dominio U1. Non è un payload. */
export function vistaPrestazioniV1(d: DettaglioRapportinoV2): EsitoSalvataggioRapportino {
  return { versione_contratto: 1, rapportino_id: d.rapportino_id, revisione: d.revisione, cantiere_id: d.cantiere_id,
    data: d.data, documento: { note: d.documento.note, ...d.documento_legacy_materiali }, prestazioni: d.prestazioni }
}
const editabile = (r: MaterialeRapportinoV1): MaterialeBozzaV1 => ({ materiale_id: r.materiale_id,
  chiave_client: r.chiave_client, descrizione: r.descrizione, unita_misura: r.unita_misura,
  quantita: r.quantita, costo_unitario: r.costo_unitario, note: r.note })
export function ricostruisciBozzaRapportinoV2(d: DettaglioRapportinoV2): BozzaRapportinoV1 {
  return { ...ricostruisciBozzaRapportinoV1(vistaPrestazioniV1(d)), materialiStrutturati: {
    versione_materiali: d.versione_materiali,
    baseline: Object.freeze(d.materiali.map(r => Object.freeze({ ...r }))),
    righe: d.materiali.filter(r => r.rimossa_at === null).map(editabile),
    documento_legacy_materiali: Object.freeze({ ...d.documento_legacy_materiali }),
  } }
}
export function creaBozzaRapportinoV2(cantiere: string, data: string): BozzaRapportinoV1 {
  return adottaMaterialiStrutturati(creaBozzaRapportinoV1(cantiere, data))
}
export function adottaMaterialiStrutturati(b: BozzaRapportinoV1): BozzaRapportinoV1 {
  if (b.materialiStrutturati?.versione_materiali === 1) return b
  return { ...b, materialiStrutturati: { versione_materiali: 1, baseline: b.materialiStrutturati?.baseline || [],
    righe: [], documento_legacy_materiali: b.materialiStrutturati?.documento_legacy_materiali ||
      Object.freeze({ materiali: b.documento.materiali, quantita_materiali: b.documento.quantita_materiali }) } }
}
function sezione(b: BozzaRapportinoV1): SezioneMaterialiBozza {
  if (b.materialiStrutturati?.versione_materiali !== 1) throw new Error('Adotta prima i materiali strutturati')
  return b.materialiStrutturati
}
export function aggiungiMaterialeBozza(b: BozzaRapportinoV1, generaChiave: () => string): BozzaRapportinoV1 {
  const s = sezione(b), chiave = generaChiave()
  if (!uuid(chiave) || [...s.baseline, ...s.righe].some(r => r.chiave_client === chiave)) throw new Error('Identità materiale non valida')
  return { ...b, materialiStrutturati: { ...s, righe: [...s.righe, { materiale_id: null, chiave_client: chiave,
    descrizione: '', unita_misura: '', quantita: '', costo_unitario: null, note: '' }] } }
}
export function modificaMaterialeBozza(b: BozzaRapportinoV1, chiave: string,
  modifica: Partial<Pick<MaterialeBozzaV1, 'descrizione' | 'unita_misura' | 'quantita' | 'costo_unitario' | 'note'>>): BozzaRapportinoV1 {
  const s = sezione(b)
  if (!s.righe.some(r => r.chiave_client === chiave)) return b
  return { ...b, materialiStrutturati: { ...s, righe: s.righe.map(r => r.chiave_client !== chiave ? r : {
    ...r, descrizione: modifica.descrizione ?? r.descrizione, unita_misura: modifica.unita_misura ?? r.unita_misura,
    quantita: modifica.quantita ?? r.quantita, note: modifica.note ?? r.note,
    costo_unitario: modifica.costo_unitario === undefined ? r.costo_unitario : modifica.costo_unitario,
  }) } }
}
export function rimuoviMaterialeBozza(b: BozzaRapportinoV1, chiave: string): BozzaRapportinoV1 {
  const s = sezione(b)
  if (!s.righe.some(r => r.chiave_client === chiave)) return b
  return { ...b, materialiStrutturati: { ...s, righe: s.righe.filter(r => r.chiave_client !== chiave) } }
}
function canonica(r: MaterialeBozzaV1): MaterialeBozzaV1 {
  if (erroriMaterialeBozza(r).length) throw new Error('Materiale non valido')
  if (!uuid(r.chiave_client) || (r.materiale_id !== null && !uuid(r.materiale_id))
    || r.descrizione !== r.descrizione.trim() || Array.from(r.descrizione).length < 1 || Array.from(r.descrizione).length > 2000
    || r.unita_misura !== r.unita_misura.trim() || Array.from(r.unita_misura).length < 1 || Array.from(r.unita_misura).length > 50
    || Array.from(r.note).length > 20000) throw new Error('Materiale non valido')
  return { materiale_id: r.materiale_id, chiave_client: r.chiave_client, descrizione: r.descrizione,
    unita_misura: r.unita_misura, quantita: decimaleMateriale(r.quantita, true), costo_unitario: costoMateriale(r.costo_unitario), note: r.note }
}
/** Messaggi UX; il builder mantiene anche i controlli di identità e baseline. */
export function erroriMaterialeBozza(r: MaterialeBozzaV1): readonly string[] {
  const errors: string[] = []
  if (!r.descrizione.trim()) errors.push('Inserisci la descrizione.')
  else if (r.descrizione !== r.descrizione.trim() || r.descrizione.length > 2000) errors.push('Verifica la descrizione (massimo 2000 caratteri).')
  if (!r.unita_misura.trim()) errors.push('Inserisci l’unità di misura.')
  else if (r.unita_misura !== r.unita_misura.trim() || r.unita_misura.length > 50) errors.push('Verifica l’unità di misura (massimo 50 caratteri).')
  try { decimaleMateriale(r.quantita, true) } catch { errors.push('Inserisci una quantità positiva, con massimo 6 decimali.') }
  try { costoMateriale(r.costo_unitario) } catch { errors.push('Inserisci un costo non negativo, con massimo 6 decimali.') }
  if (r.note.length > 20000) errors.push('Nota troppo lunga (massimo 20000 caratteri).')
  return errors
}
export function deltaMaterialiBozza(b: BozzaRapportinoV1) {
  const s = sezione(b), nuove: MaterialeBozzaV1[] = [], aggiornate: MaterialeBozzaV1[] = []
  const keys = new Set<string>(), ids = new Set<string>()
  for (const r of s.righe) {
    const c = canonica(r)
    if (keys.has(c.chiave_client) || (c.materiale_id !== null && ids.has(c.materiale_id))) throw new Error('Materiale duplicato')
    keys.add(c.chiave_client)
    if (c.materiale_id === null) {
      if (s.baseline.some(x => x.chiave_client === c.chiave_client)) throw new Error('Identità materiale già utilizzata')
      nuove.push(c)
    } else {
      ids.add(c.materiale_id)
      const old = s.baseline.find(x => x.materiale_id === c.materiale_id && x.rimossa_at === null)
      if (!old || old.chiave_client !== c.chiave_client) throw new Error('Identità materiale persistente non valida')
      if (JSON.stringify(c) !== JSON.stringify(canonica(editabile(old)))) aggiornate.push(c)
    }
  }
  const rimosse = s.baseline.filter(r => r.rimossa_at === null && !ids.has(r.materiale_id)).map(r => r.materiale_id)
  if ([nuove, aggiornate, rimosse].some(r => r.length > 100)) throw new Error('Troppi materiali')
  return { nuove, aggiornate, rimosse }
}
