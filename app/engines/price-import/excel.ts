import * as XLSX from 'xlsx'
import { normalizzaCampiManodopera } from './manodopera'

import type {
  PriceImportExcelInput,
  PriceImportRow,
} from './types'

type RawExcelRow = unknown[]

const normalizzaTesto = (value: unknown): string =>
  String(value ?? '').trim()

const normalizzaPrezzo = (value: unknown, letturaControllata = false): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const testo = normalizzaTesto(value)

  if (!testo) {
    return null
  }
  if (letturaControllata) {
    const raw = testo.replace(/[\s€]/g, '')
    // Nel CSV raw non convertire codici in date e non perdere il separatore decimale.
    if (/^[+-]?\d+(?:,\d+)?$/.test(raw) || /^[+-]?\d+\.\d{1,2}$/.test(raw)) {
      const n = Number(raw.replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }
    if (/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(raw)) return Number(raw.replaceAll('.', '').replace(',', '.'))
    return null // Separatore ambiguo: nessun valore inventato.
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

export const parsePriceListExcelDocument = (


  input: PriceImportExcelInput,
): { rows: PriceImportRow[]; testiDocumento: string[] } => {
  const workbook = XLSX.read(input.buffer, {
    type: 'array',
    cellDates: false,
    dense: false,
    ...(input.rilevaVersione ? { raw: true, codepage: 65001 } : {}),
  })


  const rowsImportate: PriceImportRow[] = []
  const testiDocumento: string[] = []

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
    testiDocumento.push(sheetName, ...rows.slice(0, headerRowIndex).map(r => r.map(normalizzaTesto).join(' ')))

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

// Non usare importo/costo/valore o "prezzo totale" come tariffa unitaria.
const espliciti = ['prezzo unitario', 'costo unitario', 'importo unitario', 'unit price', 'tariffa unitaria']
const genericiPrezzo = ['prezzo', 'price', 'tariffa', 'rate']
const esplicitoIndex = intestazioni.findIndex(h => espliciti.includes(h))
const prezzoIndex = esplicitoIndex >= 0 ? esplicitoIndex : intestazioni.findIndex(h => genericiPrezzo.includes(h))
if (descrizioneIndex < 0) return
const percentualeIndex = intestazioni.findIndex(h => ['incidenza manodopera', 'incidenza manodopera %', 'percentuale manodopera', '% manodopera'].includes(h))
const quotaIndex = intestazioni.findIndex(h => ['prezzo manodopera', 'quota manodopera', 'manodopera u m', 'manodopera'].includes(h))
const annoIndex = intestazioni.findIndex(h => h === 'anno')
const regioneIndex = intestazioni.findIndex(h => h === 'regione')
const versioneIndex = intestazioni.findIndex(h => h === 'versione')
const fonteIndex = intestazioni.findIndex(h => h === 'fonte')

    rows
      .slice(headerRowIndex + 1)
      .forEach((row, relativeIndex) => {
        const rowNumber = headerRowIndex + relativeIndex + 2

        const codice = normalizzaTesto(row[codiceIndex])
        const descrizione = normalizzaTesto(row[descrizioneIndex])
        const unitaMisura = normalizzaTesto(row[unitaMisuraIndex])
        const prezzo = prezzoIndex >= 0 ? normalizzaPrezzo(row[prezzoIndex], input.rilevaVersione) : null

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
        if (annoIndex >= 0 && normalizzaTesto(row[annoIndex])) testiDocumento.push(`Anno: ${normalizzaTesto(row[annoIndex])}`)
        if (regioneIndex >= 0 && normalizzaTesto(row[regioneIndex])) testiDocumento.push(`Regione: ${normalizzaTesto(row[regioneIndex])}`)
        if (versioneIndex >= 0 && normalizzaTesto(row[versioneIndex])) testiDocumento.push(`Versione: ${normalizzaTesto(row[versioneIndex])}`)
        if (fonteIndex >= 0 && normalizzaTesto(row[fonteIndex])) testiDocumento.push(`Fonte: ${normalizzaTesto(row[fonteIndex])}`)
        let manodopera: Partial<Pick<PriceImportRow, 'percentualeManodopera' | 'prezzoManodopera'>> = {}
        try {
          const campi = normalizzaCampiManodopera({
            ...(percentualeIndex >= 0 ? { incidenza_manodopera: normalizzaTesto(row[percentualeIndex]).replace(/%$/, '') } : {}),
            ...(quotaIndex >= 0 ? { prezzo_manodopera: row[quotaIndex] } : {}),
          })
          if (percentualeIndex >= 0) manodopera.percentualeManodopera = campi.incidenza_manodopera ?? null
          if (quotaIndex >= 0) manodopera.prezzoManodopera = campi.prezzo_manodopera ?? null
        } catch (e) { errors.push(e instanceof Error ? e.message : 'Manodopera non valida') }

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
          errors.push(prezzoIndex < 0 ? 'Colonna prezzo ambigua: indicare esplicitamente il prezzo unitario; importo/costo/valore non sono tariffe certificate.' : 'Prezzo mancante o non valido')
        }

        rowsImportate.push({
          rowNumber,
          codice,
          descrizione,
          unitaMisura,
          prezzo,
          ...manodopera,
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

  return { rows: rowsImportate, testiDocumento }
}

export const parsePriceListExcel = (input: PriceImportExcelInput): PriceImportRow[] => parsePriceListExcelDocument(input).rows
