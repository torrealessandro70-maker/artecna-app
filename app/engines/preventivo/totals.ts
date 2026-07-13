import type { PreventivoTotals, PreventivoVoce } from './types'

export const calculatePreventivoVoceTotale = (
  voce: Pick<PreventivoVoce, 'quantita' | 'prezzoUnitario'>,
): number => voce.quantita * voce.prezzoUnitario

export const calculatePreventivoTotals = (
  voci: PreventivoVoce[],
): PreventivoTotals => ({
  imponibile: voci.reduce((totale, voce) => totale + voce.totale, 0),
  numeroVoci: voci.length,
})