import type { LetturaRapportinoPortale } from './contrattoLetturaPortale'

export type ContestoLetturaRapportinoPortale = Readonly<{
  cantiere_id: string
  data: string
  rapportino_id?: string | null
}>

const uuid = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const dataValida = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
const intero = (value: unknown): value is number => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= 0
const oggetto = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const chiavi = (value: Record<string, unknown>, expected: readonly string[]) =>
  Object.keys(value).length === expected.length && expected.every(key => Object.prototype.hasOwnProperty.call(value, key))
const stessoUuid = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const orario = (value: unknown): value is string => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
const minuti = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3))

export function contestoLetturaPortaleValido(value: ContestoLetturaRapportinoPortale): boolean {
  return uuid(value.cantiere_id) && dataValida(value.data)
    && (value.rapportino_id == null || uuid(value.rapportino_id))
}

/** Fail-closed: le chiavi esatte impediscono anche di inoltrare dati economici extra. */
export function letturaPortaleValida(value: unknown, contesto: ContestoLetturaRapportinoPortale): value is LetturaRapportinoPortale {
  if (!oggetto(value) || !chiavi(value, ['versione_lettura', 'cantiere_id', 'data', 'presente', 'versione_prestazioni', 'rapportino_id', 'dettaglio'])
    || value.versione_lettura !== 1 || !uuid(value.cantiere_id) || !stessoUuid(value.cantiere_id, contesto.cantiere_id)
    || value.data !== contesto.data) return false
  if (value.versione_prestazioni === null) {
    return value.presente === false && value.rapportino_id === null && value.dettaglio === null && contesto.rapportino_id == null
  }
  if (value.presente !== true || !uuid(value.rapportino_id)
    || (contesto.rapportino_id != null && !stessoUuid(value.rapportino_id, contesto.rapportino_id))) return false
  if (value.versione_prestazioni === 0) return value.dettaglio === null
  if (value.versione_prestazioni !== 1) return false
  const dettaglio = value.dettaglio
  if (!oggetto(dettaglio) || !chiavi(dettaglio, ['versione_contratto', 'rapportino_id', 'revisione', 'cantiere_id', 'data', 'documento', 'prestazioni'])
    || dettaglio.versione_contratto !== 1 || !uuid(dettaglio.rapportino_id) || !stessoUuid(dettaglio.rapportino_id, value.rapportino_id)
    || !uuid(dettaglio.cantiere_id) || !stessoUuid(dettaglio.cantiere_id, value.cantiere_id)
    || dettaglio.data !== value.data || !intero(dettaglio.revisione)
    || !oggetto(dettaglio.documento) || !chiavi(dettaglio.documento, ['note', 'materiali', 'quantita_materiali'])
    || !Object.values(dettaglio.documento).every(item => typeof item === 'string') || !Array.isArray(dettaglio.prestazioni)) return false
  const ids = new Set<string>(), clientKeys = new Set<string>()
  for (const p of dettaglio.prestazioni) {
    if (!oggetto(p) || !chiavi(p, ['prestazione_id', 'chiave_client', 'operaio_id', 'operaio_nome', 'ora_inizio', 'ora_fine',
      'pausa_minuti', 'lavoro_in_economia', 'variante_id', 'ore', 'revisione', 'rimossa_at'])
      || !uuid(p.prestazione_id) || ids.has(p.prestazione_id.toLowerCase())
      || typeof p.chiave_client !== 'string' || p.chiave_client.trim() !== p.chiave_client
      || p.chiave_client.length < 1 || p.chiave_client.length > 200 || clientKeys.has(p.chiave_client)
      || !uuid(p.operaio_id) || typeof p.operaio_nome !== 'string'
      || !orario(p.ora_inizio) || !orario(p.ora_fine) || !intero(p.pausa_minuti)
      || minuti(p.ora_fine) - minuti(p.ora_inizio) <= p.pausa_minuti
      || typeof p.lavoro_in_economia !== 'boolean' || (p.variante_id !== null && !uuid(p.variante_id))
      || (!p.lavoro_in_economia && p.variante_id !== null)
      || typeof p.ore !== 'number' || !Number.isFinite(p.ore) || p.ore <= 0 || !intero(p.revisione)
      || (p.rimossa_at !== null && (typeof p.rimossa_at !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(p.rimossa_at)
        || !Number.isFinite(Date.parse(p.rimossa_at))))) return false
    ids.add(p.prestazione_id.toLowerCase())
    clientKeys.add(p.chiave_client)
  }
  return true
}
