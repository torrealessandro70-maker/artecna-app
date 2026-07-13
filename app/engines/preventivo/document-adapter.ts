import type { PreventivoRevision, PreventivoVoce } from './types'
import { buildPreventivoRevisionReview } from './review-builder'

import {
  calculatePreventivoTotals,
  calculatePreventivoVoceTotale,
} from './totals'

type VoceAnalizzataDocumento = {
  descrizione?: string
codice?: string
  quantita?: number
  prezzo_unitario?: number
  prezzoUnitario?: number
  unita_misura?: string
  unitaMisura?: string
  categoria?: string
  note?: string
}

type CreatePreventivoRevisionFromDocumentInput = {
  title?: string
  sourceName?: string
  voci: VoceAnalizzataDocumento[]
}

const creaIdPreventivo = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const normalizzaNumero = (valore: unknown, fallback = 0) => {
  if (typeof valore === 'number' && Number.isFinite(valore)) return valore

  if (typeof valore === 'string') {
    const numero = Number(valore.replace(',', '.'))
    return Number.isFinite(numero) ? numero : fallback
  }

  return fallback
}

export const createPreventivoRevisionFromDocument = (
  input: CreatePreventivoRevisionFromDocumentInput,
): PreventivoRevision => {
  const voci: PreventivoVoce[] = input.voci
    .filter((voce) => voce.descrizione?.trim())
        .map((voce, index) => {
      const quantita = normalizzaNumero(voce.quantita, 1)
      const prezzoUnitario = normalizzaNumero(
        voce.prezzoUnitario ?? voce.prezzo_unitario,
        0,
      )

      return {
        id: creaIdPreventivo(`voce-${index + 1}`),
        descrizione: voce.descrizione?.trim() || 'Voce senza descrizione',
codice: voce.codice?.trim() || undefined,
        quantita,
        prezzoUnitario,
        totale: calculatePreventivoVoceTotale({ quantita, prezzoUnitario }),
        unitaMisura: voce.unitaMisura ?? voce.unita_misura ?? 'corpo',
        categoria: voce.categoria,
        note: voce.note,
      }
    })

  const revision: PreventivoRevision = {
    id: creaIdPreventivo('preventivo-revision'),
    title: input.title || 'Preventivo da documento',
    createdAt: new Date().toISOString(),
    source: {
      type: 'document',
      name: input.sourceName || 'Documento analizzato',
      description: 'Preventivo generato da Document Intelligence',
    },
    voci,
    issues: [],
       totals: calculatePreventivoTotals(voci),
  }

  return buildPreventivoRevisionReview(revision)
}