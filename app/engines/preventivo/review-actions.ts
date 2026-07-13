import type { PreventivoRevision, PreventivoVoce } from './types'
import { buildPreventivoRevisionReview } from './review-builder'

import {
  calculatePreventivoTotals,
  calculatePreventivoVoceTotale,
} from './totals'

const creaVoceId = () =>
  `voce-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const addPreventivoVoce = (
  revision: PreventivoRevision,
  voce: Omit<PreventivoVoce, 'id'>,
): PreventivoRevision => {
  const nuovaRevision: PreventivoRevision = {
    ...revision,
    voci: [
      ...revision.voci,
      {
        ...voce,
        id: creaVoceId(),
      },
    ],
  }

  return buildPreventivoRevisionReview(aggiornaTotaliPreventivo(nuovaRevision))
}
const aggiornaTotaliPreventivo = (
  revision: PreventivoRevision,
): PreventivoRevision => {
  const voci = revision.voci.map((voce) => ({
    ...voce,
    totale: calculatePreventivoVoceTotale(voce),
  }))

  return {
    ...revision,
    voci,
    totals: calculatePreventivoTotals(voci),
  }
}
export const updatePreventivoVoce = (
  revision: PreventivoRevision,
  voceId: string,
  patch: Partial<Omit<PreventivoVoce, 'id'>>,
): PreventivoRevision => {
  const nuovaRevision: PreventivoRevision = {
    ...revision,
    voci: revision.voci.map((voce) =>
      voce.id === voceId
        ? {
            ...voce,
            ...patch,
          }
        : voce,
    ),
  }

  return buildPreventivoRevisionReview(aggiornaTotaliPreventivo(nuovaRevision))
}

export const removePreventivoVoce = (
  revision: PreventivoRevision,
  voceId: string,
): PreventivoRevision => {
  const nuovaRevision: PreventivoRevision = {
    ...revision,
    voci: revision.voci.filter((voce) => voce.id !== voceId),
  }

  return buildPreventivoRevisionReview(aggiornaTotaliPreventivo(nuovaRevision))
}

export const movePreventivoVoce = (
  revision: PreventivoRevision,
  fromIndex: number,
  toIndex: number,
): PreventivoRevision => {
  const voci = [...revision.voci]
  const [voceSpostata] = voci.splice(fromIndex, 1)

  if (!voceSpostata) return revision

  voci.splice(toIndex, 0, voceSpostata)

  const nuovaRevision: PreventivoRevision = {
    ...revision,
    voci,
  }

  return buildPreventivoRevisionReview(
    aggiornaTotaliPreventivo(nuovaRevision),
  )
}