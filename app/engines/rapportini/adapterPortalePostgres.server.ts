import 'server-only'
import { DatabaseError, Pool } from 'pg'
import { attachDatabasePool } from '@vercel/functions'
import { CA_SUPABASE } from './caSupabase.server'

const invocazioni = {
  crea_sessione_rapportino: { sql: 'public.crea_sessione_rapportino($1::text,$2::text)', parametri: ['p_pin', 'p_token'] },
  verifica_sessione_rapportino: { sql: 'public.verifica_sessione_rapportino($1::text,$2::uuid)', parametri: ['p_sessione', 'p_cantiere_id'] },
  varianti_rapportino_portale: { sql: 'public.varianti_rapportino_portale($1::text,$2::uuid)', parametri: ['p_sessione', 'p_cantiere_id'] },
  salva_rapportino_con_prestazioni: { sql: 'public.salva_rapportino_con_prestazioni($1::jsonb,$2::text)', parametri: ['p_payload', 'p_sessione'] },
  leggi_rapportino_portale: { sql: 'public.leggi_rapportino_portale($1::text,$2::uuid,$3::date,$4::uuid)', parametri: ['p_sessione', 'p_cantiere_id', 'p_data', 'p_rapportino_id'] },
} as const
export type RpcPortaleRapportini = keyof typeof invocazioni
let pool: Pool | undefined

// Diagnostico temporaneo: soltanto fasi/categorie statiche, mai dati runtime.
type FaseDiagnostica = 'inizio' | 'env_presente' | 'url_parsata' | 'credenziali_decodificate'
  | 'url_validata' | 'pool_creato' | 'pool_registrato' | 'connessione_avviata'
  | 'identita_verificata' | 'rpc_completata'
class ErroreIdentitaDiagnostica extends Error {}
class ErroreValidazioneUrlDiagnostica extends Error {
  constructor(readonly controlli: {
    protocollo_ok: boolean; host_ok: boolean; porta_ok: boolean; database_ok: boolean
    username_ok: boolean; password_presente: boolean; query_ok: boolean; fragment_ok: boolean
  }) { super('Configurazione Transaction Pooler Rapportini non valida') }
}
function categoriaDiagnostica(error: unknown, fase: FaseDiagnostica) {
  if (error instanceof ErroreIdentitaDiagnostica) return 'identita'
  if (fase !== 'connessione_avviata' && fase !== 'identita_verificata' && fase !== 'rpc_completata') return 'configurazione'
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
  if (typeof code === 'string') {
    if (code.startsWith('ERR_TLS_') || code.startsWith('ERR_SSL_') ||
      ['CERT_HAS_EXPIRED', 'CERT_NOT_YET_VALID', 'DEPTH_ZERO_SELF_SIGNED_CERT',
        'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
        'CERT_SIGNATURE_FAILURE'].includes(code)) return 'tls'
    if (code.startsWith('28')) return 'autenticazione'
    if (['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ERR_SOCKET_CONNECTION_TIMEOUT', '57014', '55P03'].includes(code)) return 'timeout'
  }
  if (error instanceof DatabaseError) return 'postgres'
  return 'sconosciuto'
}

function poolPortale(avanza: (fase: FaseDiagnostica) => void): Pool {
  if (pool) { avanza('pool_registrato'); return pool }
  const valore = process.env.RAPPORTINI_DATABASE_URL
  if (!valore) throw new Error('Configurazione PostgreSQL Rapportini assente')
  avanza('env_presente')
  // Non passare la URL al driver: i parametri sslmode potrebbero sovrascrivere
  // la verifica TLS esplicita. Nessuna opzione o credenziale PG globale usata.
  const url = new URL(valore)
  avanza('url_parsata')
  const user = decodeURIComponent(url.username), password = decodeURIComponent(url.password)
  avanza('credenziali_decodificate')
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !url.hostname.endsWith('.pooler.supabase.com') || url.port !== '6543'
    || url.pathname !== '/postgres' || !/^artecna_rapportini_backend\.[a-z0-9]+$/.test(user)
    || !password || url.hash || [...url.searchParams.keys()].some(key => key !== 'sslmode')
    || (url.searchParams.has('sslmode') && !['require', 'verify-full'].includes(url.searchParams.get('sslmode')!))) {
    // Solo booleani: stessi predicati della guardia invariata, nessun valore URL.
    throw new ErroreValidazioneUrlDiagnostica({
      protocollo_ok: ['postgres:', 'postgresql:'].includes(url.protocol),
      host_ok: url.hostname.endsWith('.pooler.supabase.com'),
      porta_ok: url.port === '6543', database_ok: url.pathname === '/postgres',
      username_ok: /^artecna_rapportini_backend\.[a-z0-9]+$/.test(user),
      password_presente: !!password,
      query_ok: ![...url.searchParams.keys()].some(key => key !== 'sslmode')
        && !(url.searchParams.has('sslmode') && !['require', 'verify-full'].includes(url.searchParams.get('sslmode')!)),
      fragment_ok: !url.hash,
    })
  }
  avanza('url_validata')
  const nuovo = new Pool({ host: url.hostname, port: Number(url.port), database: 'postgres', user, password,
    ssl: { ca: CA_SUPABASE, rejectUnauthorized: true }, max: 3, idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000, query_timeout: 25000, allowExitOnIdle: true,
    application_name: 'artecna-rapportini-portale' })
  avanza('pool_creato')
  // pg richiede un listener per gli errori dei client inattivi. Nessun errore
  // grezzo viene loggato; quelli delle richieste sono gestiti sotto.
  nuovo.on('error', () => {})
  attachDatabasePool(nuovo)
  avanza('pool_registrato')
  pool = nuovo
  return pool
}

export async function rpcPortalePostgres(nome: RpcPortaleRapportini, argomenti: Record<string, unknown>) {
  let fase: FaseDiagnostica = 'inizio'
  const avanza = (valore: FaseDiagnostica) => { fase = valore }
  try {
    const invocazione = Object.prototype.hasOwnProperty.call(invocazioni, nome) ? invocazioni[nome] : undefined
    if (!invocazione) throw new Error('RPC portale non autorizzata')
    const values = invocazione.parametri.map(key => key === 'p_payload' ? JSON.stringify(argomenti[key]) : argomenti[key])
    // Anche la prova pooler è fail-closed: nessun RPC se il LOGIN effettivo o
    // il ruolo corrente differiscono dal backend dedicato. Nessun SET ROLE.
    const connessioni = poolPortale(avanza)
    avanza('connessione_avviata')
    const risultato = await connessioni.query({
      text: `SELECT ${invocazione.sql} AS result WHERE session_user = 'artecna_rapportini_backend' AND current_user = 'artecna_rapportini_backend'`,
      values,
    })
    if (risultato.rows.length !== 1) throw new ErroreIdentitaDiagnostica('Identità connessione Rapportini non valida')
    avanza('identita_verificata')
    const data = risultato.rows[0].result
    avanza('rpc_completata')
    return { data, error: null }
  } catch (error) {
    try {
      // Questo errore viene creato solo dalla guardia in credenziali_decodificate.
      const c = error instanceof ErroreValidazioneUrlDiagnostica ? error.controlli : undefined
      const controlli = c ? ` protocollo_ok=${c.protocollo_ok} host_ok=${c.host_ok} porta_ok=${c.porta_ok} database_ok=${c.database_ok} username_ok=${c.username_ok} password_presente=${c.password_presente} query_ok=${c.query_ok} fragment_ok=${c.fragment_ok}` : ''
      console.error(`[RAPPORTINI_DB_DIAG] fase=${fase} categoria=${categoriaDiagnostica(error, fase)}${controlli}`)
    } catch { /* La diagnostica non deve alterare la risposta. */ }
    if (nome === 'leggi_rapportino_portale' && error instanceof DatabaseError && error.code === 'PR401') {
      return { data: null, error: { code: 'PR401', message: 'Sessione portale assente, scaduta o revocata' } }
    }
    if (error instanceof DatabaseError && error.code &&
      ['42501', 'PR409', 'PR412', '22023', '22P02', '22007', '22008', '23514', '23503', 'PR403'].includes(error.code)) {
      // Messaggi statici: mai detail, hint, query, URL, password o errore driver.
      const message = error.message === 'Costo orario operaio non valorizzato' ? error.message
        : error.code === '42501' ? 'Accesso Rapportini non consentito'
        : ['PR409', 'PR412'].includes(error.code) ? 'Rapportino modificato o richiesta in conflitto: aggiorna i dati'
        : 'Dati Rapportino non validi'
      return { data: null, error: { code: error.code, message } }
    }
    throw new Error('Connessione servizio Rapportini non disponibile')
  }
}
