import * as XLSX from 'xlsx'

import { detectDocumentHeader } from './header-detector'

import type {
  DocumentRow,
  DocumentRowType,
  ParsedDocument,
} from './types'

const normalizzaValoreCella = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

const convertiNumeroExcel = (
  value: unknown,
): number | undefined => {
  const testo = normalizzaValoreCella(value)

  if (!testo) {
    return undefined
  }

  const testoPulito = testo
    .replace(/\s/g, '')
    .replace(/[€]/g, '')
    .replace(/[^\d,.-]/g, '')

  if (!testoPulito) {
    return undefined
  }

  let valoreNormalizzato = testoPulito

  const contieneVirgola = valoreNormalizzato.includes(',')
  const contienePunto = valoreNormalizzato.includes('.')

  if (contieneVirgola && contienePunto) {
    const ultimaVirgola = valoreNormalizzato.lastIndexOf(',')
    const ultimoPunto = valoreNormalizzato.lastIndexOf('.')

    if (ultimaVirgola > ultimoPunto) {
      valoreNormalizzato = valoreNormalizzato
        .replace(/\./g, '')
        .replace(',', '.')
    } else {
      valoreNormalizzato = valoreNormalizzato.replace(/,/g, '')
    }
  } else if (contieneVirgola) {
    valoreNormalizzato = valoreNormalizzato
      .replace(/\./g, '')
      .replace(',', '.')
  }

  const numero = Number(valoreNormalizzato)

  return Number.isFinite(numero)
    ? numero
    : undefined
}

const creaRawText = (row: unknown[]): string => {
  return row
    .map(normalizzaValoreCella)
    .filter((cella) => cella !== '')
    .join(' | ')
}

const rilevaTipoRiga = (row: unknown[]): DocumentRowType => {
  const celle = row
    .map(normalizzaValoreCella)
    .filter((cella) => cella !== '')

  const ultimaCella = celle.at(-1)?.toUpperCase() || ''

  if (ultimaCella === 'VOCE') {
    return 'voce'
  }

  if (ultimaCella === 'MISURA') {
    return 'misura'
  }

  if (ultimaCella === 'SOMMANO') {
    return 'sommano'
  }

  return 'altro'
}

const estraiCodiceEDescrizioneVoce = (
  row: unknown[],
  codiceMappato: string,
  descrizioneMappata: string,
): {
  codice?: string
  descrizione: string
} => {
  const celle = row
    .map(normalizzaValoreCella)
    .filter((cella) => cella !== '')

  const regexCodice = /\bSIC\d{2}_[A-Z0-9.]+\b/i

  const indiceCodice = celle.findIndex((cella) =>
    regexCodice.test(cella),
  )

  const codiceDaCelle =
    indiceCodice >= 0
      ? celle[indiceCodice].match(regexCodice)?.[0]
      : undefined

 const codiceMappatoValido =
  regexCodice.test(codiceMappato)
    ? codiceMappato.match(regexCodice)?.[0]
    : undefined

const codice =
  codiceMappatoValido ||
  codiceDaCelle ||
  descrizioneMappata.match(regexCodice)?.[0]

  let descrizione = descrizioneMappata

  if (
    indiceCodice >= 0 &&
    celle[indiceCodice + 1] &&
    (
      !descrizione ||
      descrizione.includes('|') ||
      Boolean(codice && descrizione.includes(codice))
    )
  ) {
    descrizione = celle[indiceCodice + 1]
  }

  if (descrizione.includes('|')) {
    const parti = descrizione
      .split('|')
      .map((parte) => parte.trim())
      .filter(Boolean)

    const indiceCodiceParti = parti.findIndex((parte) =>
      regexCodice.test(parte),
    )

    if (
      indiceCodiceParti >= 0 &&
      parti[indiceCodiceParti + 1]
    ) {
      descrizione = parti[indiceCodiceParti + 1]
    }
  }

  return {
    codice: codice?.toUpperCase(),
    descrizione: descrizione.trim(),
  }
}


export const parseExcelDocument = async (
  file: File,
): Promise<ParsedDocument> => {
  const buffer = await file.arrayBuffer()

  const workbook = XLSX.read(buffer, {
    type: 'array',
  })

  const firstSheet = workbook.SheetNames[0]

  if (!firstSheet) {
    return {
      source: 'excel',
      fileName: file.name,
      rows: [],
      warnings: ['Nessun foglio trovato'],
    }
  }

  const sheet = workbook.Sheets[firstSheet]

  if (!sheet) {
    return {
      source: 'excel',
      fileName: file.name,
      rows: [],
      warnings: [`Foglio "${firstSheet}" non disponibile`],
    }
  }


  const excelRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  })

  const headerDetection = detectDocumentHeader(excelRows)

  const warnings: string[] = []

  if (!headerDetection) {
    warnings.push(
      'Intestazione colonne non riconosciuta: applicato il mapping testuale di sicurezza',
    )
  }

  const primaRigaDati = headerDetection
    ? headerDetection.headerRowIndex + 1
    : 0

  const documentRows = excelRows
    .map((row, rowIndex): DocumentRow | null => {
      if (rowIndex < primaRigaDati) {
        return null
      }

      const rawText = creaRawText(row)

      if (!rawText) {
        return null
      }

      if (!headerDetection) {
       return {
  id: `excel-row-${rowIndex + 1}`,
  source: 'excel',
  rowIndex,
  rowType: rilevaTipoRiga(row),
  descrizione: rawText,
  rawText,
}
      }

      const { columns } = headerDetection

      const descrizione =
        columns.descrizione !== undefined
          ? normalizzaValoreCella(row[columns.descrizione])
          : ''

      const codice =
        columns.codice !== undefined
          ? normalizzaValoreCella(row[columns.codice])
          : ''

const datiVoce = estraiCodiceEDescrizioneVoce(
  row,
  codice,
  descrizione,
)

      const unitaMisura =
        columns.unitaMisura !== undefined
          ? normalizzaValoreCella(row[columns.unitaMisura])
          : ''

      const quantita =
        columns.quantita !== undefined
          ? convertiNumeroExcel(row[columns.quantita])
          : undefined

      const prezzoUnitario =
        columns.prezzoUnitario !== undefined
          ? convertiNumeroExcel(row[columns.prezzoUnitario])
          : undefined

      const totale =
        columns.totale !== undefined
          ? convertiNumeroExcel(row[columns.totale])
          : undefined

     return {
  id: `excel-row-${rowIndex + 1}`,
  source: 'excel',
  rowIndex,
  rowType: rilevaTipoRiga(row),
  descrizione: datiVoce.descrizione || rawText,
codice: datiVoce.codice,
  unitaMisura: unitaMisura || undefined,
  quantita,
  prezzoUnitario,
  totale,
  rawText,
}
    })
    .filter(
      (row): row is DocumentRow => row !== null,
    )

  console.group('=== DOCUMENT PARSER ===')
  console.log('Foglio:', firstSheet)
  console.log('Righe Excel grezze:', excelRows.length)
  console.log('Header rilevato:', headerDetection)
  console.log('DocumentRow create:', documentRows.length)
  console.table(documentRows)
  console.groupEnd()

  return {
    source: 'excel',
    fileName: file.name,
    rows: documentRows,
    warnings,
  }
}