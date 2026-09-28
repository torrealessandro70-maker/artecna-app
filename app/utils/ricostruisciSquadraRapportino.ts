import type { OperaioRapportinoInput } from '../types'

export type OperaioRapportinoRicostruito = Pick<
  OperaioRapportinoInput,
  'id' | 'nome' | 'ora_inizio' | 'ora_fine'
>

export type TimbraturaRapportinoRicostruibile = {
  rapportino_id?: string | null
  operaio_id?: string | null
  operaio_nome?: string | null
  ora_entrata?: string | null
  ora_uscita?: string | null
}

export type OperaioAnagraficaRicostruibile = {
  id: string
  nome: string
}

export type RisultatoRicostruzioneSquadraRapportino =
  | {
      stato: 'ricostruito'
      squadra: OperaioRapportinoRicostruito[]
      datiNonRicostruiti: readonly ['pausa_minuti', 'costo_storico']
    }
  | {
      stato: 'non_ricostruibile'
      motivo:
        | 'rapportino_id_non_valido'
        | 'nessuna_timbratura'
        | 'operaio_id_mancante'
        | 'operaio_sconosciuto'
        | 'operaio_duplicato_anagrafica'
        | 'orario_mancante'
        | 'orario_non_valido'
        | 'operaio_con_piu_timbrature'
    }

/** Ricostruisce solo identità e intervalli, non autorizza il ricalcolo degli aggregati storici. */
export function ricostruisciSquadraRapportino(
  rapportinoId: string,
  timbrature: readonly TimbraturaRapportinoRicostruibile[],
  anagrafica: readonly OperaioAnagraficaRicostruibile[]
): RisultatoRicostruzioneSquadraRapportino {
  if (!rapportinoId.trim()) {
    return { stato: 'non_ricostruibile', motivo: 'rapportino_id_non_valido' }
  }
  const associate = timbrature.filter((riga) => riga.rapportino_id === rapportinoId)
  if (associate.length === 0) {
    return { stato: 'non_ricostruibile', motivo: 'nessuna_timbratura' }
  }

  const squadra: OperaioRapportinoRicostruito[] = []
  const identificati = new Set<string>()
  const formatoOrario = /^(?:[01]\d|2[0-3]):[0-5]\d$/
  for (const riga of associate) {
    const id = riga.operaio_id
    if (!id?.trim()) {
      return { stato: 'non_ricostruibile', motivo: 'operaio_id_mancante' }
    }
    const corrispondenze = anagrafica.filter((operaio) => operaio.id === id)
    if (corrispondenze.length === 0) {
      return { stato: 'non_ricostruibile', motivo: 'operaio_sconosciuto' }
    }
    if (corrispondenze.length > 1) {
      return { stato: 'non_ricostruibile', motivo: 'operaio_duplicato_anagrafica' }
    }
    if (identificati.has(id)) {
      return { stato: 'non_ricostruibile', motivo: 'operaio_con_piu_timbrature' }
    }

    const inizio = riga.ora_entrata
    const fine = riga.ora_uscita
    if (!inizio?.trim() || !fine?.trim()) {
      return { stato: 'non_ricostruibile', motivo: 'orario_mancante' }
    }
    if (!formatoOrario.test(inizio) || !formatoOrario.test(fine) || fine <= inizio) {
      return { stato: 'non_ricostruibile', motivo: 'orario_non_valido' }
    }

    const operaio = corrispondenze[0]
    squadra.push({ id: operaio.id, nome: operaio.nome, ora_inizio: inizio, ora_fine: fine })
    identificati.add(id)
  }

  return {
    stato: 'ricostruito',
    squadra,
    datiNonRicostruiti: ['pausa_minuti', 'costo_storico'],
  }
}
