export type CockpitSnapshot = {
  observed: string[]
  understood: string[]
  attention: string[]
  proposed: string[]
}

export function createCockpitSnapshot(): CockpitSnapshot {
  return {
    observed: [
      'Materiale consegnato',
      'Squadra presente',
      'Documentazione cucina non completa',
    ],
    understood: [
      'Il cartongesso può iniziare',
      'Serve una prova fotografica iniziale',
    ],
    attention: ['Foto cucina mancante', 'Firma cliente da acquisire'],
    proposed: ['Aprire la fotocamera', 'Generare rapportino a fine giornata'],
  }
}