export type StrumentoDisegno = 'penna' | 'evidenziatore' | 'freccia' | 'cerchio'

export type PuntoNota = {
  x: number
  y: number
}

export type SegnoNota = {
  id: string
  strumento: StrumentoDisegno
  colore: string
  spessore: number
  punti: PuntoNota[]
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
