import type { StrumentoDisegno } from './types'

export const STRUMENTI_DISEGNO: {
  id: StrumentoDisegno
  label: string
}[] = [
  { id: 'penna', label: '✏️ Penna' },
  { id: 'evidenziatore', label: '🖍 Evidenziatore' },
  { id: 'freccia', label: '↗️ Freccia' },
  { id: 'linea', label: '📏 Linea' },
  { id: 'rettangolo', label: '▭ Rettangolo' },
  { id: 'cerchio', label: '⭕ Cerchio' },
  { id: 'gomma', label: '🧽 Gomma' },
  { id: 'pin', label: '📍 Pin' },
]

export const isStrumentoManoLibera = (strumento: StrumentoDisegno) =>
  strumento === 'penna' || strumento === 'evidenziatore'

export const isStrumentoForma = (strumento: StrumentoDisegno) =>
  strumento === 'freccia' ||
  strumento === 'linea' ||
  strumento === 'rettangolo' ||
  strumento === 'cerchio'

export const isStrumentoGomma = (strumento: StrumentoDisegno) =>
  strumento === 'gomma'

export const isStrumentoTecnico = (strumento: StrumentoDisegno) =>
  strumento === 'pin'