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
