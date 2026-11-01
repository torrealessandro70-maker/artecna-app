import type { VoceAnalizzata } from '../document-intelligence/preventivo-items'
import type { DocumentRow } from './types'

export const creaVoceAnalizzataExcel = (
  row: DocumentRow,
  prezzoRiferimento?: number,
): VoceAnalizzata & { unita_misura: string; prezzo_unitario?: number } => {
  const prezzo = row.prezzoUnitario ?? prezzoRiferimento
  const unita = row.unitaMisura || ''
  return {
    codice: row.codice,
    descrizione: row.descrizione,
    unita,
    unita_misura: unita,
    quantita: row.quantita,
    prezzo,
    prezzo_unitario: prezzo,
    totale: row.totale,
  }
}

export const totaleVoceAnalizzata = (voce: Pick<VoceAnalizzata, 'totale' | 'quantita' | 'prezzo'>): number => {
  if (typeof voce.totale === 'number' && Number.isFinite(voce.totale)) return voce.totale
  if (typeof voce.quantita === 'number' && Number.isFinite(voce.quantita) &&
      typeof voce.prezzo === 'number' && Number.isFinite(voce.prezzo)) {
    return voce.quantita * voce.prezzo
  }
  return 0
}
