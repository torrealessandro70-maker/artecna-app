import type {
  OperaioRapportinoInput,
  OperaioRapportinoPreparato,
} from '../types'

export const calcolaOreRapportino = (
  oraInizio: string,
  oraFine: string,
  pausaMinuti: number
): number => {
  if (!oraInizio || !oraFine) return 0

  const [inizioOre, inizioMinuti] = oraInizio.split(':').map(Number)
  const [fineOre, fineMinuti] = oraFine.split(':').map(Number)

  const minutiInizio = inizioOre * 60 + inizioMinuti
  const minutiFine = fineOre * 60 + fineMinuti

  const minutiLavorati =
    minutiFine - minutiInizio - Math.max(0, pausaMinuti)

  if (minutiLavorati <= 0) return 0

  return minutiLavorati / 60
}

export const preparaOperaiRapportino = (
  operai: readonly OperaioRapportinoInput[]
): OperaioRapportinoPreparato[] =>
  operai.map((operaio) => ({
    ...operaio,
    ore: calcolaOreRapportino(
      operaio.ora_inizio,
      operaio.ora_fine,
      operaio.pausa_minuti
    ),
  }))
