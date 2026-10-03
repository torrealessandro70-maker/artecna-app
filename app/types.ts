// app/types.ts

export type Cantiere = {
  preventivo_contrattuale_id?: string | null
  id?: string
  nome: string
  preventivo?: number
  data_inizio_lavori?: string | null
  data_fine_lavori?: string | null
  lavori_conclusi?: boolean | null
}

export type Rapportino = {
  id?: string
  cantiere_id?: string
  compilato_da_operaio_id?: string | null
  compilato_da_nome?: string | null
  cantiere: string
  data: string
  ore: string
  note: string
  operai?: string
  numero_presenti?: string
  ore_per_operaio?: string
  materiali?: string
  quantita_materiali?: string
  costo_materiali?: string
  costo_manodopera?: number
}

export type FotoCantiere = {
  id?: string
  cantiere: string
  nota: string
  immagine_base64: string
  data_foto?: string
  geolocalizzazione?: string
  created_at?: string
  categoria?: string
}

export type Operaio = {
  id?: string
  nome: string
  telefono?: string
  qualifica?: string
  pin?: string
  nota?: string
  stato?: string
  costo_orario?: number
  created_at?: string
  accesso_portale?: boolean
}

export type OperaioRapportinoInput = {
  id: string
  nome: string
  ora_inizio: string
  ora_fine: string
  pausa_minuti: number
  costo_orario?: number
}

export type OperaioRapportinoPreparato =
  OperaioRapportinoInput & {
    readonly ore: number
  }

/**
 * Contratto operativo futuro, condiviso da desktop e portale mobile.
 * Non sostituisce i DTO legacy e non autorizza un salvataggio.
 * Gli UUID sono stringhe: formato, appartenenza e permessi andranno
 * verificati dal server. Nessun costo, tariffa o importo fa parte del DTO.
 */
export type DestinazionePrestazioneRapportino =
  | { lavoro_in_economia: false; variante_id: null }
  | { lavoro_in_economia: true; variante_id: string | null }

export type PrestazioneRapportinoInput = {
  /** UUID persistente della prestazione, non della timbratura. */
  prestazione_id: string | null
  /** Chiave stabile della riga, conservata durante creazione e retry. */
  chiave_client: string
  /** Identifica l'operaio, NON la riga: può ricorrere in più prestazioni. */
  operaio_id: string
  /** Orari HH:mm; intervallo e pausa saranno validati dal server. */
  ora_inizio: string
  ora_fine: string
  pausa_minuti: number
} & DestinazionePrestazioneRapportino

/** Proiezione minima della Variante, utilizzabile anche dal portale. */
export type VariantePrestazioneRapportino = Readonly<{
  id: string
  numero: number | null
  etichetta: string
}>

export type StatoEconomiaPrestazioneRapportino =
  | 'ordinaria'
  | 'economia_da_contabilizzare'
  | 'economia_gia_inserita'

/**
 * Risposta server: data e cantiere appartengono al Rapportino.
 * Ore = (fine - inizio - pausa) / 60, calcolate dal server.
 * Stato derivato dal flag e dal collegamento Economia, mai deciso dal client.
 * Variante minima e variante_id devono essere coerenti nella risposta server.
 * Modificare gli orari conserva prestazione_id; revisione segnala le modifiche.
 */
export type PrestazioneRapportinoLetta = Readonly<
  Omit<PrestazioneRapportinoInput, 'prestazione_id' | 'lavoro_in_economia' | 'variante_id'> &
  DestinazionePrestazioneRapportino & {
    prestazione_id: string
    operaio_nome: string
    ore: number
    revisione: number
    variante: VariantePrestazioneRapportino | null
    stato_economia: StatoEconomiaPrestazioneRapportino
    modificata_dopo_acquisizione: boolean
  }
>

/** Il server assegna l'UUID; la chiave client sopravvive ai retry. */
export type NuovaPrestazioneRapportino = PrestazioneRapportinoInput & {
  prestazione_id: null
}

/** Aggiornamento della stessa prestazione, senza riassegnarne l'UUID. */
export type PrestazioneRapportinoAggiornata = PrestazioneRapportinoInput & {
  prestazione_id: string
}

/**
 * Operazioni esplicite: omissione da un array NON significa cancellazione.
 * Le rimozioni identificano esclusivamente UUID di prestazioni persistenti.
 * Nessuna deduplicazione per operaio_id, orari o posizione nell'array.
 */
export type ModifichePrestazioniRapportino = Readonly<{
  nuove: readonly NuovaPrestazioneRapportino[]
  aggiornate: readonly PrestazioneRapportinoAggiornata[]
  rimosse: readonly string[]
}>

/**
 * Envelope manodopera V1, da integrare in futuro con gli altri campi documento.
 * richiesta_id è stabile per il retry dello stesso payload; un nuovo intento
 * usa una nuova richiesta. revisione_attesa riguarda l'intero Rapportino.
 * Non contiene ore, stati Economia o dati economici autorevoli del client.
 */
export type RichiestaPrestazioniRapportino = Readonly<{
  versione_contratto: 1
  richiesta_id: string
  cantiere_id: string
  /** Data del Rapportino nel formato YYYY-MM-DD. */
  data: string
}> & (
  | Readonly<{
      rapportino_id: null
      revisione_attesa: null
      prestazioni: Readonly<{
        nuove: readonly NuovaPrestazioneRapportino[]
        aggiornate: readonly []
        rimosse: readonly []
      }>
    }>
  | Readonly<{
      rapportino_id: string
      revisione_attesa: number
      prestazioni: ModifichePrestazioniRapportino
    }>
)

export type Timbratura = {
  id?: string
  operaio_nome: string
  cantiere: string
  data: string
  ora_entrata?: string
  ora_uscita?: string
  pausa_minuti?: number
  stato?: string
  created_at?: string
}

export type PreventivoCantiere = {
  id?: string
  cantiere: string
  importo_totale?: number
  nome_file?: string
  note?: string
  created_at?: string
  file_url?: string | null
  file_tipo?: string | null
  anteprima_testo?: string | null
  file_path?: string | null
  importo_corretto?: string | number

  origine_ai?: boolean
  stato_preventivo?: string
  descrizione_ai?: string
  json_voci_ai?: any[]
  cliente_ai?: string
  telefono_ai?: string
  indirizzo_ai?: string
  data_preventivo?: string
  sopralluogo_id?: string
  approvato?: boolean
}
export type PagamentoOperaio = {
  id?: string
  operaio_nome: string
  importo?: number
  data_pagamento?: string
  metodo?: string
  nota?: string
  created_at?: string
}

export type PagamentoFornitore = {
  id?: string
  fornitore_nome?: string
  cantiere?: string
  descrizione?: string
  importo_totale?: number
  importo_pagato?: number
  data_documento?: string
  data_scadenza?: string
  metodo?: string
  nota?: string
  created_at?: string
}
