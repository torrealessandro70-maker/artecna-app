export type DocumentSource =
  | 'excel'
  | 'pdf'
  | 'image'
  | 'ocr'

export type DocumentRowType =
  | 'voce'
  | 'misura'
  | 'sommano'
  | 'altro'

// Documentary text only: dimensions and notes never replace accounting quantity/U.M.
export type ContestoTecnicoDocumento = {
  numeroVoce?: string
  ubicazioneDimensioni?: string
  annotazioni?: string
  paginaPdf?: string
}

export type DocumentRow = {
  id: string

  source: DocumentSource

  rowIndex: number

  rowType: DocumentRowType

  descrizione: string

  codice?: string

  categoria?: string

  quantita?: number

  unitaMisura?: string

  prezzoUnitario?: number

  totale?: number

  note?: string

  rawText: string
  contestoTecnicoDocumento?: ContestoTecnicoDocumento
}

export type ParsedDocument = {
  source: DocumentSource

  fileName?: string

  rows: DocumentRow[]

  warnings: string[]
}
