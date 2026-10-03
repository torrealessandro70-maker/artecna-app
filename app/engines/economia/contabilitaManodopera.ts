/** Dati minimi: compatibili con Rapportino/Timbratura, senza cambiare i tipi UI. */
export type RapportinoContabile = {
  costo_manodopera?: number | string | null
}

export type TimbraturaContabile = {
  id?: string
  rapportino_id?: string | number | null
  stato?: string | null
}

export type ProvenienzaTimbraturaContabile =
  | 'rapportino'
  | 'rapportino_legacy'
  | 'indipendente'

export type AnomaliaManodoperaContabile = {
  codice: 'timbratura_da_rapportino_senza_id'
  indiceTimbratura: number
  timbraturaId: string | null
}

export type RiepilogoManodoperaContabile = {
  costoRapportini: number
  costoTimbratureIndipendenti: number
  costoTotaleManodoperaContabile: number
  anomalie: AnomaliaManodoperaContabile[]
}

export function classificaTimbraturaContabile(
  timbratura: TimbraturaContabile
): ProvenienzaTimbraturaContabile {
  const id = timbratura.rapportino_id
  // La provenienza non dipende dal nome, dalla tariffa o dall'esistenza del
  // Rapportino nell'array filtrato (ad esempio per data).
  if (id !== null && id !== undefined && (typeof id !== 'string' || id.trim() !== '')) {
    return 'rapportino'
  }
  if (timbratura.stato?.trim().toLowerCase().replace(/\s+/g, ' ') === 'da rapportino') {
    return 'rapportino_legacy'
  }
  return 'indipendente'
}

function costoValido(valore: number | string, contesto: string): number {
  const numero = typeof valore === 'string' && !valore.trim() ? NaN : Number(valore)
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(`Costo manodopera non valido: ${contesto}`)
  }
  return numero
}

/**
 * Riceve array già selezionati per cantiere/periodo dal chiamante.
 * Il Rapportino conserva il costo autorevole salvato. Il callback valorizza
 * soltanto le timbrature indipendenti; non cambia il loro costo operativo.
 * Costo Rapportino assente/null = 0 (compatibilità legacy); valori presenti
 * non finiti/negativi sono rifiutati. Nessun arrotondamento o accesso al DB.
 * Non include Economia, pagamenti o altri costi.
 */
export function contabilizzaManodopera<T extends TimbraturaContabile>({
  rapportini,
  timbrature,
  calcolaCostoOperativoTimbratura,
}: {
  rapportini: readonly RapportinoContabile[]
  timbrature: readonly T[]
  calcolaCostoOperativoTimbratura: (timbratura: T) => number
}): RiepilogoManodoperaContabile {
  const costoRapportini = rapportini.reduce((totale, r, indice) =>
    totale + costoValido(r.costo_manodopera ?? 0, `rapportino ${indice}`), 0)
  let costoTimbratureIndipendenti = 0
  const anomalie: AnomaliaManodoperaContabile[] = []

  timbrature.forEach((t, indiceTimbratura) => {
    const provenienza = classificaTimbraturaContabile(t)
    if (provenienza === 'rapportino_legacy') {
      anomalie.push({ codice: 'timbratura_da_rapportino_senza_id', indiceTimbratura, timbraturaId: t.id ?? null })
    }
    if (provenienza === 'indipendente') {
      costoTimbratureIndipendenti += costoValido(calcolaCostoOperativoTimbratura(t), `timbratura ${indiceTimbratura}`)
    }
  })

  const costoTotaleManodoperaContabile = costoRapportini + costoTimbratureIndipendenti
  if (!Number.isFinite(costoTotaleManodoperaContabile)) throw new Error('Totale manodopera fuori intervallo')
  return { costoRapportini, costoTimbratureIndipendenti, costoTotaleManodoperaContabile, anomalie }
}
