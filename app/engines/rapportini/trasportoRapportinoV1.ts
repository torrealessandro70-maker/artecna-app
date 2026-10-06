/** Il coordinatore interpreta risposte e errori; il wrapper sceglie autenticazione e URL. */
export type RispostaTrasportoRapportinoV1 = Pick<Response, 'ok' | 'status' | 'json'>
export type ContestoTrasportoRapportinoV1 = {
  cantiere_id: string; data?: string; rapportino_id?: string
}
export type TrasportoRapportinoV1 = {
  leggiStatoV2?: TrasportoRapportinoV1['leggiStato']
  leggiStato: (contesto: ContestoTrasportoRapportinoV1, signal?: AbortSignal) => Promise<RispostaTrasportoRapportinoV1>
  caricaVarianti: (cantiereId: string) => Promise<RispostaTrasportoRapportinoV1>
  salvaStrutturato: (corpo: string, signal: AbortSignal) => Promise<RispostaTrasportoRapportinoV1>
}
