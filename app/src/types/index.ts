export interface Cantiere {
  id?: number;
  nome: string;
  preventivo?: number;
  costoManodopera?: number;
  costoFornitori?: number;
  costoTotale?: number;
  utileReale?: number;
}

export interface Operaio {
  id?: number;
  nome: string;
  telefono?: string;
  qualifica?: string;
  pin?: string;
  costo_orario?: number;
  stato?: 'attivo' | 'sospeso';
  nota?: string;
}

export interface Timbratura {
  id?: number;
  operaio_nome: string;
  cantiere: string;
  ora_entrata?: string;
  ora_uscita?: string;
  stato?: string;
}

export interface PagamentoOperaio {
  id?: number;
  operaio_nome: string;
  importo: number;
  data_pagamento: string;
  metodo?: string;
  nota?: string;
}