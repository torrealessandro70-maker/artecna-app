import { validaPrestazioneBozza, prestazioniAttiveBozza, originalePrestazioneBozza, prestazioniUguali, type PrestazioneBozzaV1, type BozzaRapportinoV1 } from './bozzaRapportinoV1'
import type { StatoVariantiBozza } from './variantiBozzaV1'
import type { RichiestaSalvataggioRapportino, EsitoSalvataggioRapportino } from './contrattoServizio'
import { contestoLetturaPortaleValido, letturaPortaleValida } from './validaLetturaPortale'

export type TentativoSalvataggioV1 = Readonly<{
  richiesta_id: string
  cantiere_id: string
  data: string
  payload: RichiestaSalvataggioRapportino
  corpo: string
}>
const uuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

export function bozzaV1Salvabile(bozza: BozzaRapportinoV1, varianti: StatoVariantiBozza): boolean {
  const persistente = bozza.rapportino_id !== null
  if (!contestoLetturaPortaleValido(bozza) || bozza.versione_contratto !== 1
    || !(['note', 'materiali', 'quantita_materiali'] as const).every(k => typeof bozza.documento[k] === 'string'
      && Array.from(bozza.documento[k]).length <= 20000)
    || Object.values(bozza.prestazioni).some(rows => rows.length > 100)) return false
  if (persistente) {
    if (!bozza.baseline || !esitoCreazioneV1Valido(bozza.baseline, bozza)
      || bozza.baseline.rapportino_id !== bozza.rapportino_id || bozza.baseline.revisione !== bozza.revisione_attesa) return false
  } else if (bozza.revisione_attesa !== null || bozza.baseline || !bozza.prestazioni.nuove.length
    || bozza.prestazioni.aggiornate.length || bozza.prestazioni.rimosse.length) return false
  const ids = new Set<string>(), keys = new Set<string>()
  for (const id of bozza.prestazioni.rimosse) {
    if (!bozza.baseline?.prestazioni.some(p => p.prestazione_id === id && p.rimossa_at === null) || ids.has(id)) return false
    ids.add(id)
  }
  for (const p of bozza.prestazioni.aggiornate) {
    const originale = originalePrestazioneBozza(bozza, p)
    if (!originale || ids.has(p.prestazione_id) || p.operaio_id !== originale.operaio_id || p.chiave_client !== originale.chiave_client) return false
    ids.add(p.prestazione_id)
  }
  for (const p of bozza.prestazioni.nuove) {
    if (p.prestazione_id !== null || keys.has(p.chiave_client) || bozza.baseline?.prestazioni.some(a => a.chiave_client === p.chiave_client)) return false
    keys.add(p.chiave_client)
  }
  const cacheValida = varianti.cantiere_id === bozza.cantiere_id && varianti.stato === 'pronte'
  return prestazioniAttiveBozza(bozza).every(p => {
    const originale = originalePrestazioneBozza(bozza, p)
    const invariata = originale && prestazioniUguali(p, originale)
    const storico = originale?.lavoro_in_economia && p.variante_id !== null && p.variante_id === originale.variante_id
    if (!uuid(p.operaio_id) || typeof p.lavoro_in_economia !== 'boolean'
      || !p.chiave_client || p.chiave_client !== p.chiave_client.trim() || p.chiave_client.length > 200
      || (p.lavoro_in_economia && !invariata && !storico && !cacheValida)
      || validaPrestazioneBozza(p, cacheValida ? varianti.varianti : [], originale).length) return false
    return true
  })
}

/** Copia soltanto i campi contrattuali e congela anche il corpo HTTP per il retry. */
export function creaTentativoSalvataggioV1(bozza: BozzaRapportinoV1, varianti: StatoVariantiBozza,
  generaId: () => string): TentativoSalvataggioV1 {
  if (!bozzaV1Salvabile(bozza, varianti)) throw new Error('Bozza Rapportino non valida')
  const richiesta_id = generaId()
  if (!uuid(richiesta_id)) throw new Error('Identità richiesta non valida')
  const riga = (p: PrestazioneBozzaV1) => Object.freeze({
    prestazione_id: p.prestazione_id, chiave_client: p.chiave_client, operaio_id: p.operaio_id,
    ora_inizio: p.ora_inizio, ora_fine: p.ora_fine, pausa_minuti: p.pausa_minuti,
    lavoro_in_economia: p.lavoro_in_economia, variante_id: p.variante_id,
  })
  const payload = Object.freeze({
    versione_contratto: 1, richiesta_id, rapportino_id: bozza.rapportino_id, revisione_attesa: bozza.revisione_attesa,
    cantiere_id: bozza.cantiere_id, data: bozza.data,
    documento: Object.freeze({ note: bozza.documento.note, materiali: bozza.documento.materiali,
      quantita_materiali: bozza.documento.quantita_materiali }),
    prestazioni: Object.freeze({ nuove: Object.freeze(bozza.prestazioni.nuove.map(riga)),
      aggiornate: Object.freeze(bozza.prestazioni.aggiornate.filter(p => {
        const originale = originalePrestazioneBozza(bozza, p)
        return !originale || !prestazioniUguali(p, originale)
      }).map(riga)), rimosse: Object.freeze([...bozza.prestazioni.rimosse]) }),
  }) as RichiestaSalvataggioRapportino
  return Object.freeze({ richiesta_id, cantiere_id: bozza.cantiere_id, data: bozza.data, payload, corpo: JSON.stringify(payload) })
}

export function esitoCreazioneV1Valido(value: unknown, contesto: { cantiere_id: string; data: string; rapportino_id?: string | null }): value is EsitoSalvataggioRapportino {
  const v = value as Partial<EsitoSalvataggioRapportino> | null
  return letturaPortaleValida({ versione_lettura: 1, presente: true, versione_prestazioni: 1,
    rapportino_id: v?.rapportino_id, cantiere_id: v?.cantiere_id, data: v?.data, dettaglio: value }, contesto)
}

export function messaggioErroreSalvataggioV1(status: number): string {
  switch (status) {
    case 400: return 'Dati del Rapportino non validi: verifica la compilazione.'
    case 401: return 'Sessione scaduta o assente: accedi nuovamente.'
    case 403: return 'Accesso al Rapportino non consentito.'
    case 409: return 'Conflitto sul Rapportino o sulla Variante: aggiorna stato e varianti prima di riprovare.'
    default: return 'Esito del salvataggio non confermato. Puoi riprovare lo stesso salvataggio.'
  }
}
