import type { PreventivoRevision, PreventivoVoce } from './types'
import { buildPreventivoRevisionReview } from './review-builder'

import {
  calculatePreventivoTotals,
  calculatePreventivoVoceTotale,
} from './totals'

type AiPreventivoVoceInput = {
  descrizione: string
  quantita?: number
  prezzoUnitario?: number
  prezzo_unitario?: number
  unitaMisura?: string
  unita_misura?: string
  categoria?: string
  note?: string
}

type CreatePreventivoRevisionFromAiInput = {
  title?: string
  sourceName?: string
  voci: AiPreventivoVoceInput[]
}

const creaIdPreventivoAi = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const normalizzaNumeroAi = (valore: unknown, fallback = 0) => {
  if (typeof valore === 'number' && Number.isFinite(valore)) return valore

  if (typeof valore === 'string') {
    const numero = Number(valore.replace(',', '.'))
    return Number.isFinite(numero) ? numero : fallback
  }

  return fallback
}

export const createPreventivoRevisionFromAi = (
  input: CreatePreventivoRevisionFromAiInput,
): PreventivoRevision => {
  const voci: PreventivoVoce[] = input.voci
    .filter((voce) => voce.descrizione.trim())
       .map((voce, index) => {
      const quantita = normalizzaNumeroAi(voce.quantita, 1)
      const prezzoUnitario = normalizzaNumeroAi(
        voce.prezzoUnitario ?? voce.prezzo_unitario,
        0,
      )

      return {
        id: creaIdPreventivoAi(`voce-ai-${index + 1}`),
        descrizione: voce.descrizione.trim(),
        quantita,
        prezzoUnitario,
        totale: calculatePreventivoVoceTotale({ quantita, prezzoUnitario }),
        unitaMisura: voce.unitaMisura ?? voce.unita_misura ?? 'corpo',
        categoria: voce.categoria,
        note: voce.note,
      }
    })

  const revision: PreventivoRevision = {
    id: creaIdPreventivoAi('preventivo-ai-revision'),
    title: input.title || 'Preventivo AI',
    createdAt: new Date().toISOString(),
    source: {
      type: 'ai',
      name: input.sourceName || 'Assistente ARTECNA',
      description: 'Preventivo generato da sorgente AI',
    },
       voci,
    issues: [],
      totals: calculatePreventivoTotals(voci),
  }

  return buildPreventivoRevisionReview(revision)
}