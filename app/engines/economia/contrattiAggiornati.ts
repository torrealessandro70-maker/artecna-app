import { ErroreLetturaVarianti, leggiScomposizioneVarianti, type ScomposizioneVarianti } from './riepilogoEconomico'
import { importoContrattoPreventivo } from './accordiContrattuali'

export type ContrattoBase = { preventivoId: string; importo: number }
export type StatoVarianti = { stato: 'caricamento' } | { stato: 'errore'; motivo: string } |
  { stato: 'verificato'; scomposizione: ScomposizioneVarianti }
export type ContrattoAggiornato = {
  stato: 'caricamento' | 'errore' | 'non_determinabile' | 'verificato'
  base: number | null; delta: number | null; aggiornato: number | null; messaggio: string
}
type Richiesta = { cantiereId: string; preventivoId: string }
type RigaCosto = { cantiere: string; cantiere_id?: string | null }

export function baseContrattuale(c: { id?: string; preventivo_contrattuale_id?: string | null } | null | undefined,
  preventivo: { id?: string; cantiere_id?: string | null; natura?: string | null; importo_totale?: unknown; accordo_contrattuale?: unknown } | undefined): ContrattoBase | null {
  if (!c?.id || !c.preventivo_contrattuale_id || !preventivo || preventivo.id !== c.preventivo_contrattuale_id ||
      preventivo.cantiere_id !== c.id || preventivo.natura === 'integrativo') return null
  const importo = importoContrattoPreventivo(preventivo)
  if (importo === null) return null
  return Number.isSafeInteger(Math.round(importo * 100)) ? { preventivoId: preventivo.id, importo } : null
}

export function contrattoAggiornato(base: ContrattoBase | null, lettura?: StatoVarianti): ContrattoAggiornato {
  if (!base) return { stato: 'non_determinabile', base: null, delta: null, aggiornato: null, messaggio: 'Contratto non determinabile' }
  const parziale = { base: base.importo, delta: null, aggiornato: null }
  if (!lettura || lettura.stato === 'caricamento') return { ...parziale, stato: 'caricamento', messaggio: 'Caricamento varianti…' }
  if (lettura.stato === 'errore') return { ...parziale, stato: 'errore', messaggio: lettura.motivo }
  const delta = lettura.scomposizione.totale
  const totale = Math.round(base.importo * 100) + Math.round(delta * 100)
  return Number.isSafeInteger(totale)
    ? { stato: 'verificato', base: base.importo, delta, aggiornato: totale / 100, messaggio: '' }
    : { ...parziale, stato: 'errore', messaggio: 'Totale contrattuale non verificabile' }
}

export function calcolaGestione(contratto: number | null, costi: number | null) {
  const utile = contratto === null || costi === null || !Number.isFinite(costi) ? null : contratto - costi
  return { utile, margine: utile !== null && contratto ? utile / contratto * 100 : null }
}

export function totaleContratti(righe: readonly { id: string; contratto: ContrattoAggiornato }[]) {
  const ids = new Set<string>()
  let totale = 0
  for (const r of righe) {
    if (!r.id || ids.has(r.id) || r.contratto.aggiornato === null) return null
    ids.add(r.id)
    totale += Math.round(r.contratto.aggiornato * 100)
  }
  return Number.isSafeInteger(totale) ? totale / 100 : null
}

export function attribuzioneCosto(r: RigaCosto, c: { id?: string; nome: string }, nomeUnivoco: boolean) {
  if (r.cantiere_id) return r.cantiere_id === c.id ? 'inclusa' : 'esterna'
  if (r.cantiere !== c.nome) return 'esterna'
  return nomeUnivoco ? 'inclusa' : 'ambigua'
}

export const chiaveContratto = ({ cantiereId, preventivoId }: Richiesta) => JSON.stringify([cantiereId, preventivoId])

export function creaLettoreContratti(client: Parameters<typeof leggiScomposizioneVarianti>[0]) {
  let stati = new Map<string, StatoVarianti>()
  let richieste = new Map<string, Richiesta>()
  const pendenti = new Map<string, object>()
  const attivi = new Set<string>()
  const iscritti = new Set<() => void>()
  function pubblica(chiave: string, stato?: StatoVarianti) {
    stati = new Map(stati)
    if (stato) stati.set(chiave, stato)
    else stati.delete(chiave)
    iscritti.forEach(notifica => notifica())
  }
  function avanza() {
    for (const [chiave, richiesta] of richieste) {
      if (attivi.size >= 3) break
      if (attivi.has(chiave) || stati.has(chiave)) continue
      const tentativo = {}
      pendenti.set(chiave, tentativo)
      attivi.add(chiave)
      pubblica(chiave, { stato: 'caricamento' })
      void leggiScomposizioneVarianti(client, richiesta.cantiereId, richiesta.preventivoId).then(
        scomposizione => termina({ stato: 'verificato', scomposizione }),
        errore => termina({ stato: 'errore', motivo: errore instanceof ErroreLetturaVarianti
          ? errore.message : 'Lettura varianti non disponibile' }),
      )
      function termina(esito: StatoVarianti) {
        attivi.delete(chiave)
        if (pendenti.get(chiave) === tentativo) {
          pendenti.delete(chiave)
          pubblica(chiave, esito)
        }
        avanza()
      }
    }
  }
  return {
    sincronizza(elenco: Richiesta[]) {
      richieste = new Map(elenco.map(r => [chiaveContratto(r), r]))
      for (const chiave of stati.keys()) {
        if (!richieste.has(chiave)) {
          pendenti.delete(chiave)
          pubblica(chiave)
        }
      }
      avanza()
    },
    invalida(cantiereId: string) {
      for (const [chiave, r] of richieste) {
        if (r.cantiereId !== cantiereId) continue
        pendenti.delete(chiave)
        pubblica(chiave)
      }
      avanza()
    },
    snapshot: () => stati,
    iscriviti(notifica: () => void) {
      iscritti.add(notifica)
      return () => { iscritti.delete(notifica) }
    },
  }
}
