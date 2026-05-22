import { Cantiere, Timbratura } from '../types'

// Formatta numeri in euro
export const formatMoney = (value: number): string =>
  value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

// Converte ora stringa "HH:MM" in minuti
export const parseOra = (ora?: string | null): number | null => {
  if (!ora) return null
  const [h, m] = ora.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

// Calcola costo di una timbratura
export const calcolaCostoTimbratura = (timbratura: Timbratura, costoOrario?: number): number => {
  const entrata = parseOra(timbratura.ora_entrata)
  const uscita = parseOra(timbratura.ora_uscita)
  if (entrata === null || uscita === null || uscita < entrata || !costoOrario) return 0
  return ((uscita - entrata) / 60) * costoOrario
}

// Estrae totale da testo (es. scontrino)
export const estraiTotaleScontrino = (testo: string): number | null => {
  const regex = /totale[:\s]*([\d.,]+)/i
  const match = testo.match(regex)
  if (!match) return null
  const numero = parseFloat(match[1].replace(/\./g, '').replace(',', '.'))
  return isNaN(numero) ? null : numero
}

// Calcolo economia cantiere
export const calcoloEconomiaCantiere = (cantiere: Cantiere) => {
  const preventivo = cantiere.preventivo || 0
  const costoManodopera = cantiere.costoManodopera || 0
  const costoFornitori = cantiere.costoFornitori || 0
  const costoTotale = costoManodopera + costoFornitori
  const utileReale = preventivo - costoTotale
  const margine = preventivo > 0 ? (utileReale / preventivo) * 100 : 0

  return { preventivo, costoManodopera, costoFornitori, costoTotale, utileReale, margine }
}