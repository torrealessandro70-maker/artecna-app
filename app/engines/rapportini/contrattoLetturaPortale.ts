import type { EsitoSalvataggioRapportino } from './contrattoServizio'

/** Dettaglio operativo STEP 3, senza costi o stato acquisizione Economia. */
export type DettaglioRapportinoPortaleV1 = EsitoSalvataggioRapportino

type ContestoLetturaPortale = Readonly<{
  versione_lettura: 1
  cantiere_id: string
  data: string
}>

export type LetturaRapportinoPortaleAssente = ContestoLetturaPortale & Readonly<{
  presente: false
  versione_prestazioni: null
  rapportino_id: null
  dettaglio: null
}>

/** La RPC identifica V0; il dettaglio continua a essere letto dal ramo legacy. */
export type LetturaRapportinoPortaleV0 = ContestoLetturaPortale & Readonly<{
  presente: true
  versione_prestazioni: 0
  rapportino_id: string
  dettaglio: null
}>

export type LetturaRapportinoPortaleV1 = ContestoLetturaPortale & Readonly<{
  presente: true
  versione_prestazioni: 1
  rapportino_id: string
  dettaglio: DettaglioRapportinoPortaleV1
}>

/** Contratto della futura RPC read-only. Coerenza UUID/contesto verificata server-side. */
export type LetturaRapportinoPortale =
  | LetturaRapportinoPortaleAssente
  | LetturaRapportinoPortaleV0
  | LetturaRapportinoPortaleV1

/** Forma attuale di /stato V0; created_at resta esclusivamente nel documento legacy. */
export type RapportinoStatoLegacy = Readonly<{
  id: string
  data: string
  created_at: string | null
  note: string
  operai: string
  ore: string
  materiali: string
  quantita_materiali: string
}>

export type TimbraturaStatoLegacy = Readonly<{
  operaio_id?: string | null
  operaio_nome: string
  ora_entrata?: string | null
  ora_uscita?: string | null
}>

export type StatoRapportinoPortaleAssente = Readonly<{
  data: string
  presente: false
  versione_prestazioni: null
  rapportino: null
  timbrature: readonly []
}>

export type StatoRapportinoPortaleV0 = Readonly<{
  data: string
  presente: true
  versione_prestazioni: 0
  rapportino: RapportinoStatoLegacy
  timbrature: readonly TimbraturaStatoLegacy[]
}>

export type StatoRapportinoPortaleV1 = Readonly<{
  data: string
  presente: true
  versione_prestazioni: 1
  rapportino: Readonly<{ id: string; data: string }>
  timbrature: readonly []
  strutturato: DettaglioRapportinoPortaleV1
}>

/** Futuro /stato: discriminante aggiunto a V0 senza rimuovere campi legacy.
 * Nessun handler adotta ancora questi tipi. Le rimosse restano nel dettaglio
 * STEP 3 (rimossa_at non null); Economia senza Variante persistita è leggibile.
 */
export type StatoRapportinoPortale =
  | StatoRapportinoPortaleAssente
  | StatoRapportinoPortaleV0
  | StatoRapportinoPortaleV1
