export type PriceImportSourceType =
  | 'regional_price_list'
  | 'dei'
  | 'supplier'
  | 'artecna'
  | 'custom'

export type PriceImportRowStatus =
  | 'valid'
  | 'warning'
  | 'error'

export type PriceImportRow = {
  rowNumber: number

  codice: string
  descrizione: string
  unitaMisura: string
  prezzo: number | null

  fonte: string
  regione?: string
  anno?: number
  versione?: string
  tipoPrezzo: PriceImportSourceType

  status: PriceImportRowStatus
  warnings: string[]
  errors: string[]
}

export type PriceImportMetadata = {
  fonte: string
  regione?: string
  anno?: number
  versione?: string
  tipoPrezzo: PriceImportSourceType
}

export type PriceImportPreview = {
  fileName: string
  totalRows: number
  validRows: number
  warningRows: number
  errorRows: number
  rows: PriceImportRow[]
}

export type PriceImportUpsertRow = {
  codice: string
  descrizione: string
  unita_misura: string
  prezzo_unitario: number

  fonte: string
  regione: string | null
  anno: number | null
  versione: string | null
  tipo_prezzo: PriceImportSourceType
}

export type PriceImportResult = {
  success: boolean

  totalRows: number
  insertedRows: number
  updatedRows: number
  skippedRows: number
  failedRows: number

  errors: PriceImportOperationError[]
}

export type PriceImportOperationError = {
  rowNumber?: number
  codice?: string
  message: string
}

export type PriceImportExcelInput = {
  fileName: string
  buffer: ArrayBuffer
  metadata: PriceImportMetadata
}