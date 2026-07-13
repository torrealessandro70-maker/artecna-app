import type {
  PriceImportPreview,
  PriceImportRow,
} from './types'

const normalizzaChiave = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ')

const creaChiaveDuplicato = (row: PriceImportRow): string => {
  const codice = normalizzaChiave(row.codice)

  if (codice) {
    return `codice:${codice}`
  }

  return [
    'descrizione',
    normalizzaChiave(row.descrizione),
    normalizzaChiave(row.unitaMisura),
  ].join(':')
}

const validaRiga = (
  row: PriceImportRow,
  codiciDuplicati: Set<string>,
): PriceImportRow => {
  const warnings = [...row.warnings]
  const errors = [...row.errors]

  const codice = row.codice.trim()
  const descrizione = row.descrizione.trim()
  const unitaMisura = row.unitaMisura.trim()

  if (!codice && !errors.includes('Codice mancante')) {
    errors.push('Codice mancante')
  }

  if (!descrizione && !errors.includes('Descrizione mancante')) {
    errors.push('Descrizione mancante')
  }

  if (
    !unitaMisura &&
    !warnings.includes('Unità di misura mancante')
  ) {
    warnings.push('Unità di misura mancante')
  }

  if (
    row.prezzo === null ||
    !Number.isFinite(row.prezzo) ||
    row.prezzo < 0
  ) {
    if (!errors.includes('Prezzo mancante o non valido')) {
      errors.push('Prezzo mancante o non valido')
    }
  }

  if (row.prezzo === 0) {
    warnings.push('Prezzo uguale a zero')
  }

  const chiaveDuplicato = creaChiaveDuplicato(row)

  if (codiciDuplicati.has(chiaveDuplicato)) {
    warnings.push('Voce duplicata nel file')
  }

  return {
    ...row,
    codice,
    descrizione,
    unitaMisura,
    warnings: [...new Set(warnings)],
    errors: [...new Set(errors)],
    status:
      errors.length > 0
        ? 'error'
        : warnings.length > 0
          ? 'warning'
          : 'valid',
  }
}

export const validatePriceImportRows = (
  fileName: string,
  rows: PriceImportRow[],
): PriceImportPreview => {
  const chiaviViste = new Set<string>()
  const chiaviDuplicate = new Set<string>()

  rows.forEach((row) => {
    const chiave = creaChiaveDuplicato(row)

    if (chiaviViste.has(chiave)) {
      chiaviDuplicate.add(chiave)
      return
    }

    chiaviViste.add(chiave)
  })

  const validatedRows = rows.map((row) =>
    validaRiga(row, chiaviDuplicate),
  )

  return {
    fileName,
    totalRows: validatedRows.length,
    validRows: validatedRows.filter(
      (row) => row.status === 'valid',
    ).length,
    warningRows: validatedRows.filter(
      (row) => row.status === 'warning',
    ).length,
    errorRows: validatedRows.filter(
      (row) => row.status === 'error',
    ).length,
    rows: validatedRows,
  }
}