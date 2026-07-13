import {
  addPreventivoVoce,
  createPreventivoRevision,
  removePreventivoVoce,
  updatePreventivoVoce,
} from './index'

export const runPreventivoEngineSmokeTest = () => {
  const revision = createPreventivoRevision({
    sourceType: 'document',
    title: 'Smoke test Preventivo Engine',
    sourceName: 'Documento test',
    voci: [
      {
        descrizione: 'Demolizione pavimento esistente',
        quantita: 10,
        prezzoUnitario: 25,
        unitaMisura: 'mq',
      },
      {
        descrizione: 'Nuovo massetto',
        quantita: 10,
        prezzoUnitario: 38,
        unitaMisura: 'mq',
      },
    ],
  })

  const voceDaAggiornare = revision.voci[0]

  if (!voceDaAggiornare) {
    return {
      success: false,
      reason: 'Voce iniziale mancante',
      revision,
    }
  }

  const revisionAggiornata = updatePreventivoVoce(
    revision,
    voceDaAggiornare.id,
    {
      quantita: 12,
    },
  )

  const revisionConVoce = addPreventivoVoce(revisionAggiornata, {
    descrizione: 'Smaltimento materiali di risulta',
    quantita: 1,
    prezzoUnitario: 120,
    totale: 120,
    unitaMisura: 'corpo',
  })

  const voceDaRimuovere = revisionConVoce.voci[1]

  if (!voceDaRimuovere) {
    return {
      success: false,
      reason: 'Voce da rimuovere mancante',
      revision: revisionConVoce,
    }
  }

  const revisionFinale = removePreventivoVoce(
    revisionConVoce,
    voceDaRimuovere.id,
  )

  return {
    success:
      revisionFinale.voci.length === 2 &&
      revisionFinale.totals.numeroVoci === 2 &&
      revisionFinale.totals.imponibile === 420 &&
      revisionFinale.issues.length === 0,
    revision: revisionFinale,
  }
}