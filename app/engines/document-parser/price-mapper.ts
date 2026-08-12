import type { DocumentRow } from './types'

export type PriceReference = {
  codice?: string
  descrizione: string
  unitaMisura?: string
  prezzoUnitario: number
  fonte?: string
}

export type PriceMatchMethod =
  | 'codice'
  | 'descrizione_unita'
  | 'descrizione'
  | 'nessun_match'

export type PriceMatchResult = {
  rowId: string
  prezzoUnitario?: number
  fonte?: string
  metodo: PriceMatchMethod
  confidence: number
  richiedeVerifica: boolean
}

const normalizzaTesto = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizzaCodice = (value: unknown): string =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')

export const matchDocumentRowPrice = (
  row: DocumentRow,
  references: PriceReference[],
): PriceMatchResult => {
  const codiceRiga = normalizzaCodice(row.codice)

  console.group(`PRICE MATCH → ${row.codice || '(senza codice)'}`)

  console.log('DocumentRow:', {
    codice: row.codice,
    codiceNormalizzato: codiceRiga,
    descrizione: row.descrizione,
    unitaMisura: row.unitaMisura,
  })

  console.log('Reference disponibili:', references.length)

console.table(
  references.slice(0, 20).map((r) => ({
    codice: r.codice,
    descrizione: r.descrizione,
    prezzo: r.prezzoUnitario,
  })),
)

  if (codiceRiga) {
    const matchCodice = references.find(
      (reference) =>
        normalizzaCodice(reference.codice) === codiceRiga &&
        Number(reference.prezzoUnitario) > 0,
    )

    if (matchCodice) {
      console.log('MATCH TROVATO PER CODICE:', {
        codiceReference: matchCodice.codice,
        prezzo: matchCodice.prezzoUnitario,
        fonte: matchCodice.fonte,
      })

      console.groupEnd()

      return {
        rowId: row.id,
        prezzoUnitario: Number(matchCodice.prezzoUnitario),
        fonte: matchCodice.fonte,
        metodo: 'codice',
        confidence: 1,
        richiedeVerifica: false,
      }
    }
  }

  const descrizioneRiga = normalizzaTesto(row.descrizione)
  const unitaRiga = normalizzaTesto(row.unitaMisura)

  const matchDescrizioneUnita = references.find(
    (reference) =>
      normalizzaTesto(reference.descrizione) === descrizioneRiga &&
      normalizzaTesto(reference.unitaMisura) === unitaRiga &&
      Number(reference.prezzoUnitario) > 0,
  )

  if (matchDescrizioneUnita) {
    console.log('MATCH TROVATO PER DESCRIZIONE + UNITÀ:', {
      codiceReference: matchDescrizioneUnita.codice,
      prezzo: matchDescrizioneUnita.prezzoUnitario,
      fonte: matchDescrizioneUnita.fonte,
    })

    console.groupEnd()

    return {
      rowId: row.id,
      prezzoUnitario: Number(matchDescrizioneUnita.prezzoUnitario),
      fonte: matchDescrizioneUnita.fonte,
      metodo: 'descrizione_unita',
      confidence: 0.95,
      richiedeVerifica: false,
    }
  }

  const matchDescrizione = references.find(
    (reference) =>
      normalizzaTesto(reference.descrizione) === descrizioneRiga &&
      Number(reference.prezzoUnitario) > 0,
  )

  if (matchDescrizione) {
    console.log('MATCH TROVATO PER DESCRIZIONE:', {
      codiceReference: matchDescrizione.codice,
      prezzo: matchDescrizione.prezzoUnitario,
      fonte: matchDescrizione.fonte,
    })

    console.groupEnd()

    return {
      rowId: row.id,
      prezzoUnitario: Number(matchDescrizione.prezzoUnitario),
      fonte: matchDescrizione.fonte,
      metodo: 'descrizione',
      confidence: 0.85,
      richiedeVerifica: true,
    }
  }

  console.log('NESSUN MATCH TROVATO', {
    codiceCercato: codiceRiga,
    descrizioneCercata: descrizioneRiga,
    unitaCercata: unitaRiga,
  })

  console.groupEnd()

  return {
    rowId: row.id,
    metodo: 'nessun_match',
    confidence: 0,
    richiedeVerifica: true,
  }
}