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

export type FormatoSorgenteFileVariante = 'pdf' | 'excel' | 'immagine'

export type SorgenteFileVariante = {
  tipo: 'file'
  cantiereId: string
  nomeFile: string
  formato: FormatoSorgenteFileVariante
  // Occorrenza zero-based nell'estrazione, non un ID database.
  indiceVoce: number
  rigaFile?: number
  pagina?: number
}

export type SorgenteVariante = SorgentePreventivoVariante | SorgenteFileVariante

export type PropostaLavorazioneVarianteDaFile = Partial<Pick<PreventivoVoce,
  'descrizione' | 'codice' | 'unitaMisura' | 'quantita' | 'totale' | 'categoria' | 'note'
>> & {
  sorgente: SorgenteFileVariante
  prezzoSorgente?: number
}

// I warning dell'estrazione restano separati dalle anomalie della proposta.
export type AnomaliaPropostaVarianteDaFile = {
  codice:
    | 'cantiere_id_non_valido'
    | 'nome_file_mancante'
    | 'formato_non_supportato'
    | 'descrizione_mancante'
    | 'quantita_non_valida'
    | 'unita_misura_mancante'
    | 'prezzo_non_valido'
    | 'totale_non_valido'
    | 'totale_incoerente'
  indiceVoce?: number
}

export type PropostaVarianteDaFile = {
  natura: 'preventivo_integrativo'
  acquisizione: 'file'
  cantiereId: string
  file: {
    nome: string
    formato: FormatoSorgenteFileVariante
  }
  lavorazioni: PropostaLavorazioneVarianteDaFile[]
  anomalie: AnomaliaPropostaVarianteDaFile[]
}

export type RisultatoAdattamentoFileVariante =
  | { stato: 'ok'; proposta: PropostaVarianteDaFile }
  | { stato: 'errore'; anomalie: AnomaliaPropostaVarianteDaFile[] }
