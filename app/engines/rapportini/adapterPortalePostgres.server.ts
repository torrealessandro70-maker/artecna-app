import 'server-only'
import { DatabaseError, Pool } from 'pg'
import { attachDatabasePool } from '@vercel/functions'
import { CA_SUPABASE } from './caSupabase.server'

const invocazioni = {
  crea_sessione_rapportino: { sql: 'public.crea_sessione_rapportino($1::text,$2::text)', parametri: ['p_pin', 'p_token'] },
  verifica_sessione_rapportino: { sql: 'public.verifica_sessione_rapportino($1::text,$2::uuid)', parametri: ['p_sessione', 'p_cantiere_id'] },
  varianti_rapportino_portale: { sql: 'public.varianti_rapportino_portale($1::text,$2::uuid)', parametri: ['p_sessione', 'p_cantiere_id'] },
  salva_rapportino_con_prestazioni: { sql: 'public.salva_rapportino_con_prestazioni($1::jsonb,$2::text)', parametri: ['p_payload', 'p_sessione'] },
} as const
export type RpcPortaleRapportini = keyof typeof invocazioni
let pool: Pool | undefined

function poolPortale(): Pool {
  if (pool) return pool
  const valore = process.env.RAPPORTINI_DATABASE_URL
  if (!valore) throw new Error('Configurazione PostgreSQL Rapportini assente')
  // Non passare la URL al driver: i parametri sslmode potrebbero sovrascrivere
  // la verifica TLS esplicita. Nessuna opzione o credenziale PG globale usata.
  const url = new URL(valore)
  const user = decodeURIComponent(url.username), password = decodeURIComponent(url.password)
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !url.hostname.endsWith('.pooler.supabase.com') || url.port !== '6543'
    || url.pathname !== '/postgres' || !/^artecna_rapportini_backend\.[a-z0-9]+$/.test(user)
    || !password || url.hash || [...url.searchParams.keys()].some(key => key !== 'sslmode')
    || (url.searchParams.has('sslmode') && !['require', 'verify-full'].includes(url.searchParams.get('sslmode')!))) {
    throw new Error('Configurazione Transaction Pooler Rapportini non valida')
  }
  const nuovo = new Pool({ host: url.hostname, port: Number(url.port), database: 'postgres', user, password,
    ssl: { ca: CA_SUPABASE, rejectUnauthorized: true }, max: 3, idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000, query_timeout: 25000, allowExitOnIdle: true,
    application_name: 'artecna-rapportini-portale' })
  // pg richiede un listener per gli errori dei client inattivi. Nessun errore
  // grezzo viene loggato; quelli delle richieste sono gestiti sotto.
  nuovo.on('error', () => {})
  attachDatabasePool(nuovo)
  pool = nuovo
  return pool
}

export async function rpcPortalePostgres(nome: RpcPortaleRapportini, argomenti: Record<string, unknown>) {
  const invocazione = invocazioni[nome]
  if (!invocazione) throw new Error('RPC portale non autorizzata')
  const values = invocazione.parametri.map(key => key === 'p_payload' ? JSON.stringify(argomenti[key]) : argomenti[key])
  try {
    // Anche la prova pooler è fail-closed: nessun RPC se il LOGIN effettivo o
    // il ruolo corrente differiscono dal backend dedicato. Nessun SET ROLE.
    const risultato = await poolPortale().query({
      text: `SELECT ${invocazione.sql} AS result WHERE session_user = 'artecna_rapportini_backend' AND current_user = 'artecna_rapportini_backend'`,
      values,
    })
    if (risultato.rows.length !== 1) throw new Error('Identità connessione Rapportini non valida')
    return { data: risultato.rows[0].result, error: null }
  } catch (error) {
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
