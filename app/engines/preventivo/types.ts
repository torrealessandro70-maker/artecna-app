export type PreventivoSourceType =
  | 'document'
  | 'ai'
  | 'manual'
  | 'imported'
  | 'unknown'

export type PreventivoSource = {
  type: PreventivoSourceType
  name?: string
  description?: string
}

export type PreventivoVoce = {
  id: string
  descrizione: string
  codice?: string
  quantita: number
  prezzoUnitario: number
  totale: number
  unitaMisura?: string
  categoria?: string
  note?: string
}
export type PreventivoReviewIssueSeverity = 'info' | 'warning' | 'critical'

export type PreventivoReviewIssue = {
  id: string
  severity: PreventivoReviewIssueSeverity
  title: string
  description?: string
  voceId?: string
}

export type PreventivoRevision = {
  id: string
  source: PreventivoSource
  title: string
  createdAt: string
  voci: PreventivoVoce[]
  issues: PreventivoReviewIssue[]
  totals: PreventivoTotals
}

export type CreatePreventivoRevisionInput =
  | {
      sourceType: 'document'
      title?: string
      sourceName?: string
      voci: {
        descrizione?: string
codice?: string
        quantita?: number
        prezzo_unitario?: number
        prezzoUnitario?: number
        unita_misura?: string
        unitaMisura?: string
        categoria?: string
        note?: string
      }[]
    }
  | {
      sourceType: 'ai'
      title?: string
      sourceName?: string
      voci: {
        descrizione: string
codice?: string
        quantita?: number
        prezzo_unitario?: number
        prezzoUnitario?: number
        unita_misura?: string
        unitaMisura?: string
        categoria?: string
        note?: string
      }[]
    }

export type PreventivoTotals = {
  imponibile: number
  numeroVoci: number
}