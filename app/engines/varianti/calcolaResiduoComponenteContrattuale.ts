export type RiduzioneApprovataComponente = Readonly<{
  id: string
  quantitaDelta: number
  deltaContratto: number
}>

export type InputResiduoComponenteContrattuale = Readonly<{
  componenteId: string
  descrizione: string
  unitaMisura: string
  quantitaIniziale: number
  prezzoUnitario: number
  // Il chiamante certifica approvazione e riferimento diretto al componente.
  // Gli aumenti costituiscono componenti distinti, non elementi di questo array.
  riduzioniApprovate: readonly RiduzioneApprovataComponente[]
  quantitaMaturata: number | null
}>

export type ComponenteContrattualeConResiduo = Readonly<{
  componenteId: string
  descrizione: string
  unitaMisura: string
  quantitaIniziale: number
  prezzoUnitario: number
  quantitaRidottaApprovata: number
  quantitaContrattualeCorrente: number
  quantitaMaturata: number
  quantitaRiducibile: number
  importoContrattualeCorrente: number
  importoMaturato: number
  importoRiducibile: number
}>

export type CodiceAnomaliaResiduoComponente =
  | 'componente_id_non_valido'
  | 'descrizione_mancante'
  | 'unita_misura_mancante'
  | 'quantita_iniziale_non_valida'
  | 'prezzo_non_valido'
  | 'riduzione_id_non_valido'
  | 'riduzione_duplicata'
  | 'quantita_riduzione_non_valida'
  | 'delta_riduzione_non_valido'
  | 'delta_riduzione_incoerente'
  | 'quantita_contrattuale_negativa'
  | 'quantita_maturata_non_disponibile'
  | 'quantita_maturata_non_valida'
  | 'quantita_maturata_superiore_al_contratto'
  | 'quantita_riducibile_negativa'
  | 'quantita_calcolata_non_finita'
  | 'importo_non_rappresentabile'

export type AnomaliaResiduoComponente = Readonly<{
  codice: CodiceAnomaliaResiduoComponente
  indiceRiduzione?: number
  riduzioneId?: string
}>

export type RisultatoResiduoComponenteContrattuale =
  | Readonly<{ stato: 'ok'; componente: ComponenteContrattualeConResiduo }>
  | Readonly<{ stato: 'errore'; anomalie: readonly AnomaliaResiduoComponente[] }>

const testoValido = (testo: string): boolean => typeof testo === 'string' && testo.trim().length > 0

// Solo rumore floating-point: mai una tolleranza commerciale di un centesimo.
const tolleranzaFloatingPoint = (valore: number): number =>
  Math.min(1e-7, 4 * Number.EPSILON * Math.max(1, Math.abs(valore)))

// Pari distanza: lontano da zero, anche per importi negativi (round numeric).
// Nessun arrotondamento delle quantità. Valori oltre i centesimi rappresentabili
// come interi sicuri vengono rifiutati, anziché fingere precisione monetaria.
function roundMonetario(valore: number): number {
  if (!Number.isFinite(valore)) return Number.NaN
  const centesimi = Math.abs(valore) * 100
  if (!Number.isFinite(centesimi)) return Number.NaN
  const arrotondato = Math.round(centesimi + tolleranzaFloatingPoint(centesimi))
  if (!Number.isSafeInteger(arrotondato)) return Number.NaN
  return arrotondato === 0 ? 0 : Math.sign(valore) * arrotondato / 100
}

export function calcolaResiduoComponenteContrattuale(
  input: InputResiduoComponenteContrattuale,
): RisultatoResiduoComponenteContrattuale {
  const anomalie: AnomaliaResiduoComponente[] = []
  if (!testoValido(input.componenteId)) anomalie.push({ codice: 'componente_id_non_valido' })
  if (!testoValido(input.descrizione)) anomalie.push({ codice: 'descrizione_mancante' })
  if (!testoValido(input.unitaMisura)) anomalie.push({ codice: 'unita_misura_mancante' })
  const quantitaValida = Number.isFinite(input.quantitaIniziale) && input.quantitaIniziale > 0
  const prezzoValido = Number.isFinite(input.prezzoUnitario) && input.prezzoUnitario > 0
  if (!quantitaValida) anomalie.push({ codice: 'quantita_iniziale_non_valida' })
  if (!prezzoValido) anomalie.push({ codice: 'prezzo_non_valido' })
  if (input.quantitaMaturata === null) {
    anomalie.push({ codice: 'quantita_maturata_non_disponibile' })
  } else if (!Number.isFinite(input.quantitaMaturata) || input.quantitaMaturata < 0) {
    anomalie.push({ codice: 'quantita_maturata_non_valida' })
  }

  const ids = new Set<string>()
  input.riduzioniApprovate.forEach((riduzione, indiceRiduzione) => {
    const idValido = testoValido(riduzione.id)
    const segnala = (codice: CodiceAnomaliaResiduoComponente) => {
      anomalie.push({ codice, indiceRiduzione, ...(idValido ? { riduzioneId: riduzione.id } : {}) })
    }
    if (!idValido) segnala('riduzione_id_non_valido')
    else {
      const id = riduzione.id.trim()
      if (ids.has(id)) segnala('riduzione_duplicata')
      ids.add(id)
    }
    const qValida = Number.isFinite(riduzione.quantitaDelta) && riduzione.quantitaDelta < 0
    const dValido = Number.isFinite(riduzione.deltaContratto) && riduzione.deltaContratto < 0
    if (!qValida) segnala('quantita_riduzione_non_valida')
    if (!dValido) segnala('delta_riduzione_non_valido')
    if (qValida && prezzoValido && dValido) {
      const atteso = roundMonetario(riduzione.quantitaDelta * input.prezzoUnitario)
      if (!Number.isFinite(atteso)) segnala('importo_non_rappresentabile')
      else if (Math.abs(atteso - riduzione.deltaContratto) > tolleranzaFloatingPoint(atteso)) {
        segnala('delta_riduzione_incoerente')
      }
    }
  })
  if (anomalie.length || input.quantitaMaturata === null) return { stato: 'errore', anomalie }

  // Ordine numerico canonico su una copia: la somma non dipende dall'ordine input.
  const riduzioni = input.riduzioniApprovate.map(r => r.quantitaDelta).sort((a, b) => a - b)
  const sommaRiduzioni = riduzioni.reduce((somma, q) => somma + q, 0)
  const quantitaContrattualeCorrente = input.quantitaIniziale + sommaRiduzioni
  const quantitaRiducibile = quantitaContrattualeCorrente - input.quantitaMaturata
  if (![sommaRiduzioni, quantitaContrattualeCorrente, quantitaRiducibile].every(Number.isFinite)) {
    return { stato: 'errore', anomalie: [{ codice: 'quantita_calcolata_non_finita' }] }
  }
  if (quantitaContrattualeCorrente < 0) anomalie.push({ codice: 'quantita_contrattuale_negativa' })
  if (input.quantitaMaturata > quantitaContrattualeCorrente) {
    anomalie.push({ codice: 'quantita_maturata_superiore_al_contratto' })
  }
  if (quantitaRiducibile < 0) anomalie.push({ codice: 'quantita_riducibile_negativa' })
  if (anomalie.length) return { stato: 'errore', anomalie }

  const importoContrattualeCorrente = roundMonetario(quantitaContrattualeCorrente * input.prezzoUnitario)
  const importoMaturato = roundMonetario(input.quantitaMaturata * input.prezzoUnitario)
  const importoRiducibile = roundMonetario(quantitaRiducibile * input.prezzoUnitario)
  if (![importoContrattualeCorrente, importoMaturato, importoRiducibile].every(Number.isFinite)) {
    return { stato: 'errore', anomalie: [{ codice: 'importo_non_rappresentabile' }] }
  }
  return {
    stato: 'ok',
    componente: {
      componenteId: input.componenteId,
      descrizione: input.descrizione,
      unitaMisura: input.unitaMisura,
      quantitaIniziale: input.quantitaIniziale,
      prezzoUnitario: input.prezzoUnitario,
      quantitaRidottaApprovata: sommaRiduzioni === 0 ? 0 : -sommaRiduzioni,
      quantitaContrattualeCorrente,
      quantitaMaturata: input.quantitaMaturata,
      quantitaRiducibile,
      importoContrattualeCorrente,
      importoMaturato,
      importoRiducibile,
    },
  }
}
