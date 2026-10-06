import type { DettaglioRapportinoPortaleV1 } from './contrattoLetturaPortale'

/** DTO condiviso dal writer contratto 2 e dalla lettura 2, senza conversioni floating point. */
export type MaterialeRapportinoV1 = Readonly<{
  materiale_id: string; chiave_client: string; descrizione: string; unita_misura: string
  quantita: string; costo_unitario: string | null; costo_totale: string | null
  note: string; revisione: number; rimossa_at: string | null
}>
export type RiepilogoMaterialiRapportinoV1 = Readonly<{
  totale_materiali_valorizzati: string
  numero_materiali_da_valorizzare: number
  valorizzazione_completa: boolean
}>
export type EsitoRapportinoContrattoDue = Readonly<{
  versione_contratto: 2; rapportino_id: string; revisione: number; cantiere_id: string; data: string
  documento: Readonly<{ note: string }>
  prestazioni: DettaglioRapportinoPortaleV1['prestazioni']
  versione_materiali: 1
  materiali: readonly MaterialeRapportinoV1[]
  riepilogo_materiali: RiepilogoMaterialiRapportinoV1
}>
export type DettaglioRapportinoV2 = Omit<EsitoRapportinoContrattoDue, 'versione_materiali'> & Readonly<{
  versione_materiali: 0 | 1
  /** Storia testuale, anche dopo adozione: mai interpretata come righe o totale. */
  documento_legacy_materiali: Readonly<{ materiali: string; quantita_materiali: string }>
}>
type Contesto = Readonly<{ versione_lettura: 2; cantiere_id: string; data: string }>
export type StatoRapportinoV2 = Contesto & (
  | Readonly<{ presente: false; versione_prestazioni: null; rapportino_id: null; dettaglio: null }>
  | Readonly<{ presente: true; versione_prestazioni: 0; rapportino_id: string; dettaglio: null }>
  | Readonly<{ presente: true; versione_prestazioni: 1; rapportino_id: string; dettaglio: DettaglioRapportinoV2 }>
)
