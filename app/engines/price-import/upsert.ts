import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizzaCampiManodopera } from './manodopera'
import { erroriRigaRegionale } from './regional-metadata'

import type {
  PriceImportPreview,
  PriceImportResult,
  PriceImportUpsertRow,
} from './types'

const BATCH_SIZE = 500

const creaChiaveUpsert = (
  row: PriceImportUpsertRow,
): string => {
  return [
    row.codice.trim().toLowerCase(),
    row.fonte.trim().toLowerCase(),
    (row.versione || '').trim().toLowerCase(),
  ].join('::')
}

export const creaPayloadImportazione = (
  preview: PriceImportPreview,
  manodoperaPersistente = false,
): PriceImportUpsertRow[] => {
  const righeImportabili = preview.rows
    .filter(
      (row) =>
        row.status !== 'error' &&
        row.prezzo !== null &&
        row.codice.trim() &&
        row.descrizione.trim(),
    )
    .map<PriceImportUpsertRow>((row) => {
      const errors = erroriRigaRegionale(row, preview.prezzario)
      if (errors.length) throw Error(errors.join(' '))
      return ({
      codice: row.codice.trim(),
      descrizione: row.descrizione.trim(),
      unita_misura: row.unitaMisura.trim(),
      prezzo_unitario: row.prezzo as number,

      fonte: row.fonte.trim(),
      regione: row.regione?.trim() || null,
      anno: row.anno ?? null,
      versione: row.versione?.trim() || null,
      tipo_prezzo: row.tipoPrezzo,
      ...(manodoperaPersistente ? normalizzaCampiManodopera({
        incidenza_manodopera: row.percentualeManodopera ?? null,
        prezzo_manodopera: row.prezzoManodopera ?? null,
      }) : {}),
    })})

  const righeUniche = new Map<
    string,
    PriceImportUpsertRow
  >()

  righeImportabili.forEach((row) => {
    const chiave = creaChiaveUpsert(row)

    /*
     * In caso di duplicato conserva l’ultima riga trovata.
     * Questo evita che PostgreSQL aggiorni due volte
     * la stessa voce nella medesima istruzione upsert.
     */
    righeUniche.set(chiave, row)
  })

  return Array.from(righeUniche.values())
}

const dividiInBlocchi = <T>(
  values: T[],
  blockSize: number,
): T[][] => {
  const blocks: T[][] = []

  for (
    let index = 0;
    index < values.length;
    index += blockSize
  ) {
    blocks.push(values.slice(index, index + blockSize))
  }

  return blocks
}

export const upsertPriceImportPreview = async (
  supabase: SupabaseClient,
  preview: PriceImportPreview,
  manodoperaPersistente = false,
): Promise<PriceImportResult> => {
  const payload = creaPayloadImportazione(preview, manodoperaPersistente)
  const blocks = dividiInBlocchi(payload, BATCH_SIZE)

  let importedRows = 0
  let failedRows = 0

  const errors: PriceImportResult['errors'] = []

  for (const block of blocks) {
    const { error } = await supabase
      .from('prezzi_lavorazioni')
      .upsert(block, {
        onConflict: 'codice,fonte,versione',
        ignoreDuplicates: false,
      })

    if (error) {
      failedRows += block.length

      errors.push({
        message: error.message,
      })

      continue
    }

    importedRows += block.length
  }

  return {
    success: failedRows === 0,

    totalRows: preview.totalRows,

    insertedRows: importedRows,
    updatedRows: 0,
    skippedRows: preview.totalRows - payload.length,
    failedRows,

    errors,
  }
}
