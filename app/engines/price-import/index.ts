import { parsePriceListExcel } from './excel'
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
  const rows = parsePriceListExcel(input)

  return validatePriceImportRows(
    input.fileName,
    rows,
  )
}

export { upsertPriceImportPreview } from './upsert'