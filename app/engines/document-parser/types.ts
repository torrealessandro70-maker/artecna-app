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
}

export type ParsedDocument = {
  source: DocumentSource

  fileName?: string

  rows: DocumentRow[]

  warnings: string[]
}