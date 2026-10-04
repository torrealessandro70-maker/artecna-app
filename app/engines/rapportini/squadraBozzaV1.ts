import { aggiungiPrestazioneBozza, modificaPrestazioneBozza, validaPrestazioneBozza, type BozzaRapportinoV1 } from './bozzaRapportinoV1'
import type { StatoVariantiBozza } from './variantiBozzaV1'

/** Solo stato del pannello: non appartiene al contratto del writer. */
export type SquadraBozzaV1 = {
  operai: readonly string[]
  ora_inizio: string
  ora_fine: string
  pausa_minuti: number
  lavoro_in_economia: boolean
  variante_id: string | null
}
export const creaSquadraBozzaV1 = (): SquadraBozzaV1 => ({ operai: [], ora_inizio: '', ora_fine: '',
  pausa_minuti: 0, lavoro_in_economia: false, variante_id: null })

export function validaSquadraBozzaV1(s: SquadraBozzaV1, bozza: BozzaRapportinoV1,
  operai: readonly { id: string }[], varianti: StatoVariantiBozza): readonly string[] {
  const comune = { prestazione_id: null, chiave_client: '', operaio_id: s.operai[0] || '',
    ora_inizio: s.ora_inizio, ora_fine: s.ora_fine, pausa_minuti: s.pausa_minuti }
  const errori = validaPrestazioneBozza(s.lavoro_in_economia
    ? { ...comune, lavoro_in_economia: true, variante_id: s.variante_id }
    : { ...comune, lavoro_in_economia: false, variante_id: null },
    varianti.stato === 'pronte' && varianti.cantiere_id === bozza.cantiere_id ? varianti.varianti : [])
  return [...errori, ...(!s.lavoro_in_economia && s.variante_id !== null ? ['Ordinario non può avere una variante'] : []),
    ...(s.operai.some(id => !operai.some(o => o.id === id)) || new Set(s.operai).size !== s.operai.length
    ? ['Selezione operai non valida'] : [])]
}

export function aggiungiSquadraBozzaV1(bozza: BozzaRapportinoV1, s: SquadraBozzaV1,
  operai: readonly { id: string }[], varianti: StatoVariantiBozza, generaChiave: () => string): BozzaRapportinoV1 {
  if (validaSquadraBozzaV1(s, bozza, operai, varianti).length) throw new Error('Squadra non valida')
  return s.operai.reduce((b, operaio_id) => {
    const chiave = generaChiave()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chiave)) throw new Error('Identità prestazione non valida')
    const aggiunta = aggiungiPrestazioneBozza(b, chiave)
    const aggiornata = modificaPrestazioneBozza(aggiunta, chiave, { operaio_id, ora_inizio: s.ora_inizio,
      ora_fine: s.ora_fine, pausa_minuti: s.pausa_minuti, lavoro_in_economia: s.lavoro_in_economia })
    return modificaPrestazioneBozza(aggiornata, chiave, { variante_id: s.lavoro_in_economia ? s.variante_id : null })
  }, bozza)
}
