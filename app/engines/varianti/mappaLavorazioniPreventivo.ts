import type { VocePreventivoSorgente } from './types'

export type RigaPreventivoLavorazioneDb = Readonly<{
  id?: unknown
  preventivo_id?: unknown
  cantiere_id?: unknown
  descrizione?: unknown
  quantita?: unknown
  unita_misura?: unknown
  prezzo_unitario?: unknown
  importo_previsto?: unknown
}>

export type AnomaliaMappingLavorazionePreventivo = {
  codice:
    | 'id_riga_non_valido'
    | 'descrizione_mancante'
    | 'quantita_non_valida'
    | 'unita_misura_mancante'
    | 'prezzo_non_valido'
    | 'totale_non_valido'
  indiceRiga: number
}

export type RisultatoMappingLavorazioniPreventivo = {
  voci: VocePreventivoSorgente[]
  anomalie: AnomaliaMappingLavorazionePreventivo[]
}

const testoUtile = (valore: unknown): string | undefined =>
  typeof valore === 'string' && valore.trim().length > 0 ? valore : undefined

const numeroSemplice = (valore: unknown): number | undefined => {
  if (typeof valore === 'number') return Number.isFinite(valore) ? valore : undefined
  if (typeof valore !== 'string') return undefined
  const testo = valore.trim()
  // Un solo separatore decimale; nessuna interpretazione di separatori delle migliaia.
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(testo)) return undefined
  const numero = Number(testo.replace(',', '.'))
  return Number.isFinite(numero) ? numero : undefined
}

export function mappaLavorazioniPreventivo(
  righe: readonly RigaPreventivoLavorazioneDb[],
): RisultatoMappingLavorazioniPreventivo {
  const anomalie: AnomaliaMappingLavorazionePreventivo[] = []
  const voci = righe.map((riga, indiceRiga): VocePreventivoSorgente => {
    const segnala = (codice: AnomaliaMappingLavorazionePreventivo['codice']) => {
      anomalie.push({ codice, indiceRiga })
    }
    const id = typeof riga.id === 'number' && Number.isFinite(riga.id)
      ? String(riga.id)
      : testoUtile(riga.id)
    const descrizione = testoUtile(riga.descrizione)
    const unitaMisura = testoUtile(riga.unita_misura)
    const quantita = numeroSemplice(riga.quantita)
    const prezzoUnitario = numeroSemplice(riga.prezzo_unitario)
    const totale = numeroSemplice(riga.importo_previsto)

    if (id === undefined) segnala('id_riga_non_valido')
    if (descrizione === undefined) segnala('descrizione_mancante')
    if (quantita === undefined || quantita <= 0) segnala('quantita_non_valida')
    if (unitaMisura === undefined) segnala('unita_misura_mancante')
    if (prezzoUnitario === undefined || prezzoUnitario < 0) segnala('prezzo_non_valido')
    if (totale === undefined || totale < 0) segnala('totale_non_valido')

    // Conserva anche numeri semanticamente invalidi per consentirne la revisione.
    // Appartenenza e coerenza del totale restano responsabilità di repository e adapter.
    return { id, descrizione, quantita, unitaMisura, prezzoUnitario, totale }
  })
  return { voci, anomalie }
}
