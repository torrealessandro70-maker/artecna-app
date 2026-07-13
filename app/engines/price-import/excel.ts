import * as XLSX from 'xlsx'

import type {
  PriceImportExcelInput,
  PriceImportRow,
} from './types'

type RawExcelRow = unknown[]

const normalizzaTesto = (value: unknown): string =>
  String(value ?? '').trim()

const normalizzaPrezzo = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const testo = normalizzaTesto(value)

  if (!testo) {
    return null
  }

  const valoreNormalizzato = testo
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')

  const prezzo = Number(valoreNormalizzato)

  return Number.isFinite(prezzo) ? prezzo : null
}

const sembraCodicePrezzario = (value: unknown): boolean => {
  const testo = normalizzaTesto(value)

  return /^[A-Z]{2,}\d*[_\s.-]?\d/i.test(testo)
}

const normalizzaIntestazione = (value: unknown): string =>
  normalizzaTesto(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[€$£]/g, ' ')
    .replace(/[().,:;/\\_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const trovaIndiceColonna = (
  intestazioni: string[],
  aliases: string[],
): number => {
  const aliasesNormalizzati = aliases.map(normalizzaIntestazione)

  return intestazioni.findIndex((intestazione) => {
    const valoreNormalizzato =
      normalizzaIntestazione(intestazione)

    return aliasesNormalizzati.some((alias) => {
      if (!alias) {
        return false
      }

      return (
        valoreNormalizzato === alias ||
        valoreNormalizzato.includes(alias)
      )
    })
  })
}

const trovaRigaIntestazione = (
  rows: RawExcelRow[],
): number => {
  const limite = Math.min(rows.length, 80)

  for (let index = 0; index < limite; index += 1) {
    const valori = rows[index].map(normalizzaIntestazione)

    const haCodice = valori.some((value) =>
      [
        'codice',
        'cod articolo',
        'codice articolo',
        'articolo',
        'voce',
        'cod voce',
        'codice voce',
        'item code',
        'product code',
        'sku',
        'rif',
        'riferimento',
      ].some((alias) => value.includes(alias)),
    )

    const haDescrizione = valori.some((value) =>
      [
        'descrizione',
        'descrizione voce',
        'descrizione articolo',
        'lavorazione',
        'denominazione',
        'prestazione',
        'materiale',
        'prodotto',
        'description',
        'item description',
      ].some((alias) => value.includes(alias)),
    )

    const haUnitaMisura = valori.some((value) =>
      [
        'unita misura',
        'unita di misura',
        'um',
        'u m',
        'udm',
        'unit',
        'misura',
      ].some((alias) => value.includes(alias)),
    )

    const haPrezzo = valori.some((value) =>
      [
        'prezzo',
        'prezzo unitario',
        'costo',
        'costo unitario',
        'importo',
        'tariffa',
        'valore',
        'price',
        'unit price',
        'rate',
      ].some((alias) => value.includes(alias)),
    )

    const numeroCampiRiconosciuti = [
      haCodice,
      haDescrizione,
      haUnitaMisura,
      haPrezzo,
    ].filter(Boolean).length

    if (
      haDescrizione &&
      haPrezzo &&
      numeroCampiRiconosciuti >= 3
    ) {
      return index
    }
  }

  return -1
}

export const parsePriceListExcel = (


  input: PriceImportExcelInput,
): PriceImportRow[] => {
  const workbook = XLSX.read(input.buffer, {
    type: 'array',
    cellDates: false,
    dense: false,
  })


  const rowsImportate: PriceImportRow[] = []

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName]

    if (!sheet) {
      return
    }

    const rows = XLSX.utils.sheet_to_json<RawExcelRow>(sheet, {
  header: 1,
  defval: '',
  raw: true,
})



    if (rows.length === 0) {
      return
    }

    const headerRowIndex = trovaRigaIntestazione(rows)

    if (headerRowIndex < 0) {
      return
    }

   const intestazioni =
  rows[headerRowIndex].map(normalizzaIntestazione)

    const codiceIndex = trovaIndiceColonna(intestazioni, [
  'codice',
  'cod articolo',
  'codice articolo',
  'cod voce',
  'codice voce',
  'articolo',
  'voce',
  'item code',
  'product code',
  'sku',
  'riferimento',
  'rif',
])

const descrizioneIndex = trovaIndiceColonna(intestazioni, [
  'descrizione',
  'descrizione voce',
  'descrizione articolo',
  'lavorazione',
  'denominazione',
  'prestazione',
  'materiale',
  'prodotto',
  'description',
  'item description',
])

const unitaMisuraIndex = trovaIndiceColonna(intestazioni, [
  'unita di misura',
  'unita misura',
  'u m',
  'um',
  'udm',
  'unit',
  'misura',
])

const prezzoIndex = trovaIndiceColonna(intestazioni, [
  'prezzo unitario',
  'prezzo',
  'costo unitario',
  'costo',
  'importo unitario',
  'importo',
  'tariffa',
  'valore',
  'unit price',
  'price',
  'rate',
])

if (
  descrizioneIndex < 0 ||
  prezzoIndex < 0
) {
  return
}
    rows
      .slice(headerRowIndex + 1)
      .forEach((row, relativeIndex) => {
        const rowNumber = headerRowIndex + relativeIndex + 2

        const codice = normalizzaTesto(row[codiceIndex])
        const descrizione = normalizzaTesto(row[descrizioneIndex])
        const unitaMisura = normalizzaTesto(row[unitaMisuraIndex])
        const prezzo = normalizzaPrezzo(row[prezzoIndex])

        const rigaVuota =
          !codice &&
          !descrizione &&
          !unitaMisura &&
          prezzo === null

        if (rigaVuota) {
          return
        }

        const warnings: string[] = []
        const errors: string[] = []

        if (!codice) {
          errors.push('Codice mancante')
        } else if (!sembraCodicePrezzario(codice)) {
          warnings.push('Formato codice non riconosciuto')
        }

        if (!descrizione) {
          errors.push('Descrizione mancante')
        }

        if (!unitaMisura) {
          warnings.push('Unità di misura mancante')
        }

        if (prezzo === null) {
          errors.push('Prezzo mancante o non valido')
        }

        rowsImportate.push({
          rowNumber,
          codice,
          descrizione,
          unitaMisura,
          prezzo,
          fonte: input.metadata.fonte,
          regione: input.metadata.regione,
          anno: input.metadata.anno,
          versione: input.metadata.versione,
          tipoPrezzo: input.metadata.tipoPrezzo,
          status:
            errors.length > 0
              ? 'error'
              : warnings.length > 0
                ? 'warning'
                : 'valid',
          warnings,
          errors,
        })
      })
  })

  return rowsImportate
}