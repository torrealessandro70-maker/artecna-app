import type { RichiestaPrestazioniRapportino, VariantePrestazioneRapportino, PrestazioneRapportinoInput } from '../../types'

// Estensioni separate: nessuna modifica/duplicazione dei contratti STEP 1.
export type RichiestaSalvataggioRapportino = RichiestaPrestazioniRapportino & {
  documento?: Readonly<{ note?: string; materiali?: string; quantita_materiali?: string }>
}
export type VarianteRapportinoPortale = VariantePrestazioneRapportino & Readonly<{ selezionabile: boolean }>
export type EsitoSalvataggioRapportino = Readonly<{
  versione_contratto: 1; rapportino_id: string; revisione: number; cantiere_id: string; data: string
  documento: Readonly<{ note: string; materiali: string; quantita_materiali: string }>
  // Stato/acquisizione Economia arriveranno nello STEP 6; nessun costo operativo esposto.
  prestazioni: readonly (PrestazioneRapportinoInput & Readonly<{
    prestazione_id: string; operaio_nome: string; ore: number; revisione: number; rimossa_at: string | null
  }>)[]
}>
