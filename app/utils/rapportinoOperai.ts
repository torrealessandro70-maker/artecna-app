import type {
  OperaioRapportinoInput,
  OperaioRapportinoPreparato,
} from '../types'

export const calcolaOreNetteTimbratura = (
  oraEntrata?: string | null,
  oraUscita?: string | null,
  pausaMinuti?: number | null
): number => {
  const formatoOrario = /^(?:[01]\d|2[0-3]):[0-5]\d$/
  if (!oraEntrata || !oraUscita ||
      !formatoOrario.test(oraEntrata) || !formatoOrario.test(oraUscita)) return 0

  const [entrataOre, entrataMinuti] = oraEntrata.split(':').map(Number)
  const [uscitaOre, uscitaMinuti] = oraUscita.split(':').map(Number)
  const entrata = entrataOre * 60 + entrataMinuti
  const uscita = uscitaOre * 60 + uscitaMinuti
  if (uscita <= entrata) return 0

  const pausa = Math.max(0, Number(pausaMinuti || 0))
  const minutiNetti = uscita - entrata - pausa
  return minutiNetti <= 0 ? 0 : minutiNetti / 60
}

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
