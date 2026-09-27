import type { OperaioRapportinoInput } from '../types'

export type PropostaOperaioRiconosciuto = {
  chiaveMenzione: string
  operaioId: string
  ora_inizio?: string
  ora_fine?: string
}

export type OperaioAnagraficaRiconosciuto = Pick<
  OperaioRapportinoInput, 'id' | 'nome' | 'costo_orario'
>

export type EsitoApplicazioneOperaio = {
  operaioId: string
  chiaviMenzioni: string[]
  stato: 'aggiunto' | 'completato' | 'invariato' | 'conflitto' | 'escluso'
  orariDaCompletare: boolean
  motivo?:
    | 'id_non_valido'
    | 'id_duplicato'
    | 'orari_non_validi'
    | 'menzioni_incompatibili'
    | 'orari_esistenti_diversi'
    | 'proposta_incompleta'
}

export type RisultatoApplicazioneOperai = {
  operai: OperaioRapportinoInput[]
  esiti: EsitoApplicazioneOperaio[]
}

const orarioValido = (ora: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(ora)

/** Merge per ID: conserva i dati esistenti e non combina turni distinti. */
export function applicaOperaiRiconosciuti(
  squadra: readonly OperaioRapportinoInput[],
  proposte: readonly PropostaOperaioRiconosciuto[],
  anagrafica: readonly OperaioAnagraficaRiconosciuto[]
): RisultatoApplicazioneOperai {
  const operai = squadra.map((operaio) => ({ ...operaio }))
  const esiti: EsitoApplicazioneOperaio[] = []
  const gruppi = new Map<string, PropostaOperaioRiconosciuto[]>()
  for (const proposta of proposte) {
    const gruppo = gruppi.get(proposta.operaioId) || []
    gruppo.push(proposta)
    gruppi.set(proposta.operaioId, gruppo)
  }

  for (const [id, gruppo] of gruppi) {
    const disponibili = anagrafica.filter((operaio) => operaio.id === id)
    const presenti = operai.filter((operaio) => operaio.id === id)
    const esistente = presenti[0]
    const esito: EsitoApplicazioneOperaio = {
      operaioId: id,
      chiaviMenzioni: gruppo.map((proposta) => proposta.chiaveMenzione),
      stato: 'invariato',
      orariDaCompletare: !esistente?.ora_inizio || !esistente?.ora_fine,
    }
    esiti.push(esito)
    if (!id.trim() || disponibili.length === 0) {
      esito.stato = 'escluso'
      esito.motivo = 'id_non_valido'
      continue
    }
    if (disponibili.length > 1 || presenti.length > 1) {
      esito.stato = 'conflitto'
      esito.motivo = 'id_duplicato'
      continue
    }

    const intervalli = gruppo.map((proposta) => ({
      inizio: proposta.ora_inizio ?? '',
      fine: proposta.ora_fine ?? '',
    }))
    if (intervalli.some(({ inizio, fine }) =>
      (inizio !== '' && !orarioValido(inizio)) ||
      (fine !== '' && !orarioValido(fine)) ||
      (inizio !== '' && fine !== '' && fine <= inizio)
    )) {
      esito.stato = 'conflitto'
      esito.motivo = 'orari_non_validi'
      continue
    }
    const distinti = new Map(intervalli
      .filter(({ inizio, fine }) => inizio || fine)
      .map((intervallo) => [JSON.stringify(intervallo), intervallo]))
    // Anche i parziali differenti richiedono verifica: mai unire estremi.
    if (distinti.size > 1) {
      esito.stato = 'conflitto'
      esito.motivo = 'menzioni_incompatibili'
      continue
    }
    const { inizio, fine } = distinti.values().next().value || { inizio: '', fine: '' }

    if (!esistente) {
      const canonico = disponibili[0]
      operai.push({
        id,
        nome: canonico.nome,
        ora_inizio: inizio,
        ora_fine: fine,
        pausa_minuti: 0,
        ...(canonico.costo_orario !== undefined ? { costo_orario: canonico.costo_orario } : {}),
      })
      esito.stato = 'aggiunto'
      esito.orariDaCompletare = !inizio || !fine
      continue
    }
    if (!inizio && !fine) continue
    if ((inizio && esistente.ora_inizio && inizio !== esistente.ora_inizio) ||
        (fine && esistente.ora_fine && fine !== esistente.ora_fine)) {
      esito.stato = 'conflitto'
      esito.motivo = 'orari_esistenti_diversi'
      continue
    }
    if (inizio === esistente.ora_inizio && fine === esistente.ora_fine) continue
    if (!inizio || !fine) {
      esito.motivo = 'proposta_incompleta'
      continue
    }
    // Il clone può essere completato soltanto se gli estremi presenti coincidono.
    esistente.ora_inizio = inizio
    esistente.ora_fine = fine
    esito.stato = 'completato'
    esito.orariDaCompletare = false
  }

  return { operai, esiti }
}
