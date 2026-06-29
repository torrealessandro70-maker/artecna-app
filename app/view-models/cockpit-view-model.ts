export type CockpitSnapshotInput = {
  cantiereName?: string
  subtitle?: string
  status?: string
  focus?: string
  observed?: string[]
  understood?: string[]
  attention?: string[]
  proposed?: string[]
}
export type CockpitSnapshot = {
  cantiereName: string
  subtitle: string
  status: string
  focus: string
  observed: string[]
  understood: string[]
  attention: string[]
  proposed: string[]
}
export function createCockpitSnapshot(
  input: CockpitSnapshotInput = {}
): CockpitSnapshot {
 return {
  cantiereName: input.cantiereName || 'Villa Scirè',
  subtitle: input.subtitle || 'Fascicolo di Cantiere · ARTECNA OS',
  status: input.status || 'PUOI INIZIARE',
  focus: input.focus || 'Cartongesso piano terra',

    observed: input.observed || [
      'Materiale consegnato',
      'Squadra presente',
      'Documentazione cucina non completa',
    ],

    understood: input.understood || [
      'Il cartongesso può iniziare',
      'Serve una prova fotografica iniziale',
    ],

    attention: input.attention || [
      'Foto cucina mancante',
      'Firma cliente da acquisire',
    ],

    proposed: input.proposed || [
      'Aprire la fotocamera',
      'Generare rapportino a fine giornata',
    ],
  }
}