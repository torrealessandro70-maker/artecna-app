export type Cantiere = {
  id?: string | number
  nome: string
  preventivo?: number
  created_at?: string
}

export type Operaio = {
  id?: string | number
  nome: string
  telefono?: string
  qualifica?: string
  pin?: string
  costo_orario?: number
  stato?: string
  nota?: string
}

export type Timbratura = {
  id?: string | number
  operaio_nome: string
  cantiere?: string
  data?: string
  ora_entrata?: string
  ora_uscita?: string
  stato?: string
}

export type Rapportino = {
  id?: string | number
  cantiere?: string
  data?: string
  ore?: string | number
  note?: string
}

export type PagamentoOperaio = {
  id?: string | number
  operaio_nome: string
  importo: number
  data_pagamento?: string
  metodo?: string
  nota?: string
}