import { totaleContratti, type ContrattoAggiornato } from './contrattiAggiornati'

export type DestinazioneCantiere = 'cantiere_lavori' | 'archivio_acquisti_personali'
export type FaseLavori = 'in_programma' | 'in_corso'
export type StatoLavori = FaseLavori | 'concluso' | 'da_precisare'
export type ClassificazioneCantiere = {
  destinazione_amministrativa?: DestinazioneCantiere | null
  fase_lavori?: FaseLavori | null
  lavori_conclusi?: boolean | null
}

export const gruppiHome = {
  in_programma: 'Cantieri in programma',
  in_corso: 'Cantieri in corso',
  concluso: 'Cantieri conclusi',
  archivio: 'Archivi personali',
  da_classificare: 'Cantieri da classificare',
  da_precisare: 'Stato lavori da precisare',
} as const

export function statoLavori(cantiere: ClassificazioneCantiere): StatoLavori {
  if (cantiere.lavori_conclusi === true) return 'concluso'
  return cantiere.fase_lavori ?? 'da_precisare'
}

export function gruppoHome(cantiere: ClassificazioneCantiere): keyof typeof gruppiHome {
  if (cantiere.destinazione_amministrativa === 'archivio_acquisti_personali') return 'archivio'
  if (cantiere.destinazione_amministrativa !== 'cantiere_lavori') return 'da_classificare'
  return statoLavori(cantiere)
}

export function riepilogoContrattiHome<T extends ClassificazioneCantiere & { id: string; contratto: ContrattoAggiornato }>(
  righe: readonly T[], elencoPronto: boolean,
) {
  const commerciali = righe.filter(c => c.destinazione_amministrativa === 'cantiere_lavori')
  const verificati = commerciali.filter(c => c.contratto.stato === 'verificato')
  const daClassificare = righe.filter(c => gruppoHome(c) === 'da_classificare').length
  return {
    commerciali,
    nonDeterminabili: commerciali.length - verificati.length,
    daClassificare,
    parziale: elencoPronto && verificati.length > 0 ? totaleContratti(verificati) : null,
    complessivo: elencoPronto && daClassificare === 0 ? totaleContratti(commerciali) : null,
  }
}
