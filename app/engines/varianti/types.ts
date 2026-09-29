import type { PreventivoVoce } from '../preventivo/types'

export type NaturaVariante = 'preventivo_integrativo' | 'lavori_in_economia'
export type AcquisizioneVariante = 'manuale' | 'dati_artecna' | 'file'

// Partial consente di revisionare anche voci strutturate incomplete.
export type VocePreventivoSorgente = Readonly<Partial<PreventivoVoce>>

export type SorgentePreventivoVariante = {
  tipo: 'preventivo_strutturato'
  cantiereId: string
  preventivoSorgenteId: string
  lavorazioneSorgenteId?: string
}

export type PropostaLavorazioneVariante = Omit<Partial<PreventivoVoce>, 'id'> & {
  sorgente: SorgentePreventivoVariante
  prezzoSorgente?: number
  prezzoSuggerito?: number
  prezzoConfermato?: number
}

export type AnomaliaPropostaVariante = {
  codice:
    | 'cantiere_id_non_valido'
    | 'preventivo_sorgente_id_non_valido'
    | 'lavorazione_sorgente_id_non_valido'
    | 'descrizione_mancante'
    | 'quantita_non_valida'
    | 'unita_misura_mancante'
    | 'prezzo_non_valido'
    | 'totale_non_valido'
    | 'totale_incoerente'
  // Indice zero-based: distingue anche voci prive di ID o con lo stesso ID.
  indiceVoce?: number
}

// Una proposta revisionabile, non un'autorizzazione al salvataggio/approvazione.
export type PropostaVarianteDaPreventivo = {
  natura: 'preventivo_integrativo'
  acquisizione: 'dati_artecna'
  cantiereId: string
  preventivoSorgenteId: string
  lavorazioni: PropostaLavorazioneVariante[]
  anomalie: AnomaliaPropostaVariante[]
}
