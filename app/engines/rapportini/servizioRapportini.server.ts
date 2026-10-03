import 'server-only'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { rpcPortalePostgres, type RpcPortaleRapportini } from './adapterPortalePostgres.server'
import type { RichiestaSalvataggioRapportino, VarianteRapportinoPortale, EsitoSalvataggioRapportino } from './contrattoServizio'
type AccessoPortale = {
  operaio: { id: string; nome: string }; operai: { id: string; nome: string }[]; cantieri: { id: string; nome: string }[]
}
export const COOKIE_SESSIONE_RAPPORTINO = 'artecna_rapportino_sessione'
export const DURATA_SESSIONE_SECONDI = 8 * 60 * 60
export class ErroreServizioRapportini extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message) }
}
function clientDesktop(bearer: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new ErroreServizioRapportini('Configurazione servizio Rapportini non disponibile', 503, 'CONFIG')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(bearer ? { global: { headers: { Authorization: `Bearer ${bearer}` } } } : {}) })
}
function controllaErrore(error: { message: string; code: string } | null) {
  if (!error) return
  const status = error.code === '42501' ? 403 : ['PR409', 'PR412'].includes(error.code) ? 409
    : ['22023', '22P02', '22007', '22008', '23514', '23503', 'PR403'].includes(error.code) ? 400 : 500
  throw new ErroreServizioRapportini(status === 500 ? 'Servizio Rapportini non disponibile' : error.message, status, error.code)
}
async function rpcRapportini(nome: RpcPortaleRapportini, argomenti: Record<string, unknown>, bearer?: string) {
  try {
    const risultato = bearer ? await clientDesktop(bearer).rpc(nome, argomenti) : await rpcPortalePostgres(nome, argomenti)
    controllaErrore(risultato.error)
    return risultato.data
  } catch (error) {
    if (error instanceof ErroreServizioRapportini) throw error
    // I logger legacy non devono ricevere errori grezzi del trasporto,
    // che possono contenere request/header e credenziali del backend.
    throw new ErroreServizioRapportini('Servizio Rapportini non disponibile', 503, 'TRANSPORT')
  }
}
export function tokenSessioneRapportino(cookieHeader: string | null): string | null {
  const value = cookieHeader?.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE_SESSIONE_RAPPORTINO}=`))
    ?.slice(COOKIE_SESSIONE_RAPPORTINO.length + 1)
  return value && /^[0-9a-f]{64}$/.test(value) ? value : null
}
export function verificaOrigineRapportino(req: Request) {
  const origin = req.headers.get('origin')
  if ((origin && origin !== new URL(req.url).origin) || req.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ErroreServizioRapportini('Origine richiesta non consentita', 403, 'ORIGIN')
  }
}
export async function creaSessioneRapportino(pin: string): Promise<{ accesso: AccessoPortale; token: string }> {
  if (!pin || pin.length > 100) throw new ErroreServizioRapportini('Inserisci un PIN valido', 400, 'PIN')
  const token = randomBytes(32).toString('hex')
  const data = await rpcRapportini('crea_sessione_rapportino', { p_pin: pin, p_token: token })
  return { accesso: data as AccessoPortale, token }
}
export async function verificaSessioneRapportino(req: Request, cantiereId: string): Promise<{ id: string; nome: string }> {
  const sessione = tokenSessioneRapportino(req.headers.get('cookie'))
  if (!sessione) throw new ErroreServizioRapportini('Sessione portale assente: accedi nuovamente', 401, 'SESSIONE')
  const data = await rpcRapportini('verifica_sessione_rapportino', { p_sessione: sessione, p_cantiere_id: cantiereId })
  return data as { id: string; nome: string }
}
export async function salvaRapportinoConPrestazioni(req: Request, payload: RichiestaSalvataggioRapportino): Promise<EsitoSalvataggioRapportino> {
  verificaOrigineRapportino(req)
  const bearer = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1]
  const sessione = bearer ? null : tokenSessioneRapportino(req.headers.get('cookie'))
  if (!bearer && !sessione) throw new ErroreServizioRapportini('Autenticazione obbligatoria', 401, 'SESSIONE')
  // Identità desktop validata da PostgREST; identità mobile risolta dal DB.
  const data = await rpcRapportini('salva_rapportino_con_prestazioni', { p_payload: payload, p_sessione: sessione }, bearer)
  return data as EsitoSalvataggioRapportino
}
export async function leggiVariantiRapportinoPortale(req: Request, cantiereId: string): Promise<readonly VarianteRapportinoPortale[]> {
  const sessione = tokenSessioneRapportino(req.headers.get('cookie'))
  if (!sessione) throw new ErroreServizioRapportini('Sessione portale assente', 401, 'SESSIONE')
  const data = await rpcRapportini('varianti_rapportino_portale', { p_sessione: sessione, p_cantiere_id: cantiereId })
  return data as VarianteRapportinoPortale[]
}
