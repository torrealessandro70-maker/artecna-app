import type { TrasportoRapportinoV1 } from '../engines/rapportini/trasportoRapportinoV1'

/** Stessi endpoint e corpi Mobile; cookie e sessione restano gestiti dal browser/server. */
export const trasportoMobileRapportinoV1: TrasportoRapportinoV1 = {
  leggiStato: ({ cantiere_id, data, rapportino_id }, signal) => fetch('/api/rapportino/stato', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cantiereId: cantiere_id, data: data || undefined, rapportinoId: rapportino_id }),
    ...(signal ? { signal } : {}),
  }),
  caricaVarianti: cantiereId => fetch('/api/rapportino/varianti', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cantiere_id: cantiereId }),
  }),
  salvaStrutturato: (corpo, signal) => fetch('/api/rapportino/strutturato', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo, signal,
  }),
}
