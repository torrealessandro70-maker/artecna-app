// app/types.ts

export type Cantiere = {
  id?: string
  nome: string
  preventivo?: number
  data_inizio_lavori?: string | null
  data_fine_lavori?: string | null
  lavori_conclusi?: boolean | null
}

export type Rapportino = {
  id?: string
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
}

export type Timbratura = {
  id?: string
  operaio_nome: string
  cantiere: string
  data: string
  ora_entrata?: string
  ora_uscita?: string
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