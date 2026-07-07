export type StrumentoDisegno =
  | 'penna'
  | 'evidenziatore'
  | 'freccia'
  | 'linea'
  | 'rettangolo'
  | 'cerchio'
  | 'gomma'
  | 'pin'

export type PuntoNota = {
  x: number
  y: number
}

export type MetadatiSegnoNota = {
  numero?: number

  titolo?: string

  testo?: string

  descrizione?: string

  stato?: 'nuovo' | 'in_lavorazione' | 'risolto'

  categoria?:
    | 'rilievo'
    | 'difetto'
    | 'impianto'
    | 'misura'
    | 'promemoria'
}

export type SegnoNota = {
  id: string
  strumento: StrumentoDisegno
  colore: string
  spessore: number
  punti: PuntoNota[]
  metadati?: MetadatiSegnoNota
}

export type PaginaQuadernoNota = {
  id: string
  titolo: string
  disegni: SegnoNota[]
  sfondoDisegno: string | null
}
export type VoceChecklistNota = {
  id: string
  testo: string
  completata: boolean
}

export type AllegatoNota = {
  id: string
  nome_file: string
  tipo: 'foto' | 'allegato' | 'audio'
  mime_type?: string | null
  storage_path: string
  url: string
  created_at?: string
}

export type AnalisiNota = {
  sintesi: string
  ipotesi: string[]
  verifiche: string[]
  domande: string[]
  avvertenza: string
}
export type PinNota = {
  id: string
  numero: number
  x: number
  y: number
}