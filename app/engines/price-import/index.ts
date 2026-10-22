import { parsePriceListExcel, parsePriceListExcelDocument } from './excel'
import { rilevaPrezzarioRegionale } from './regional-metadata'
import type {
  PriceImportExcelInput,
  PriceImportPreview,
} from './types'
import { validatePriceImportRows } from './validator'

export type {
  PriceImportExcelInput,
  PriceImportMetadata,
  PriceImportOperationError,
  PriceImportPreview,
  PriceImportResult,
  PriceImportRow,
  PriceImportRowStatus,
  PriceImportSourceType,
  PriceImportUpsertRow,
} from './types'

export { parsePriceListExcel } from './excel'
export { validatePriceImportRows } from './validator'

export const buildPriceImportPreview = (
  input: PriceImportExcelInput,
): PriceImportPreview => {
  if (input.rilevaVersione) {
    const document = parsePriceListExcelDocument(input)
    const prezzario = rilevaPrezzarioRegionale(document.testiDocumento, document.rows.map(r => r.codice))
    const rows = document.rows.map(row => ({ ...row, fonte: prezzario.fonte, regione: prezzario.regione,
      anno: prezzario.anno, versione: prezzario.versione, tipoPrezzo: prezzario.tipoPrezzo }))
    return { ...validatePriceImportRows(input.fileName, rows), prezzario }
  }
  const rows = parsePriceListExcel(input)

  return validatePriceImportRows(
    input.fileName,
    rows,
  )
}

export { upsertPriceImportPreview } from './upsert'
