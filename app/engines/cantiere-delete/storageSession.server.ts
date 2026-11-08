import 'server-only'
import { randomInt } from 'node:crypto'
import { Client, type ClientConfig } from 'pg'
import { CA_SUPABASE } from '../rapportini/caSupabase.server'
import type { StorageJob, WorkerConnection } from './storageWorker.server'

const fail = () => new Error('STORAGE_SESSION_UNAVAILABLE')
export function storageConnectionConfig(value: string | undefined): ClientConfig {
  if (!value) throw fail()
  try {
    const url = new URL(value), user = decodeURIComponent(url.username)
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.port !== '5432'
      || !url.hostname.endsWith('.pooler.supabase.com') || url.pathname !== '/postgres'
      || user !== 'artecna_storage_worker_login.axuiaiglbahygsmeoypy' || !url.password || url.hash
      || [...url.searchParams.keys()].some(k => k !== 'sslmode')
      || (url.searchParams.has('sslmode') && !['require', 'verify-full'].includes(url.searchParams.get('sslmode')!))) throw fail()
    return { host: url.hostname, port: 5432, database: 'postgres', user, password: decodeURIComponent(url.password),
      ssl: { ca: CA_SUPABASE, rejectUnauthorized: true }, connectionTimeoutMillis: 5_000,
      query_timeout: 5_000, statement_timeout: 5_000, application_name: 'artecna-storage-cleanup' }
  } catch { throw fail() }
}

/** The single Client is retained across every transaction and external request.
 * The factory is injected only in local tests; configured runtime has no fallback. */
export async function openStorageSession(config: ClientConfig, create = (c: ClientConfig) => new Client(c)) {
  const client = create(config), key = randomInt(1, 2_147_483_647)
  let pid: number, broken = false, closing: Promise<void> | undefined
  client.on('error', () => { broken = true })
  const close = () => { broken = true; return closing ??= client.end().catch(() => { /* no raw driver error */ }) }
  try {
    await client.connect()
    await client.query('BEGIN')
    const before = await client.query("SELECT pg_backend_pid() pid, session_user='artecna_storage_worker_login' AND current_user='artecna_storage_worker_login' AND pg_has_role(session_user,'artecna_storage_worker','USAGE') AND has_function_privilege(current_user,'artecna_distruzione.storage_claim()','EXECUTE') AND has_function_privilege(current_user,'artecna_distruzione.storage_finish(bigint,uuid,boolean,boolean,text)','EXECUTE') AND has_function_privilege(current_user,'artecna_distruzione.storage_verifica_job(bigint,uuid)','EXECUTE') identity, pg_try_advisory_lock(7112026,$1::integer) locked", [key])
    pid = before.rows[0].pid
    if (!before.rows[0].identity || !before.rows[0].locked) throw fail()
    await client.query('COMMIT')
    const after = await client.query("SELECT pg_backend_pid() pid, EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted AND classid=7112026 AND objid=$1::oid AND objsubid=2) locked", [key])
    if (after.rows[0].pid !== pid || !after.rows[0].locked || broken) throw fail()
    const released = await client.query('SELECT pg_advisory_unlock(7112026,$1::integer) released', [key])
    if (released.rows[0]?.released !== true || broken) throw fail()
    const connection: WorkerConnection = {
      async query(sql, values) { if (broken) throw fail(); return client.query(sql, values) },
      release(error) { if (error) { broken = true; void close() } },
      async verifySession(job: StorageJob) {
        if (broken) throw fail()
        const r = await client.query('SELECT pg_backend_pid() pid, artecna_distruzione.storage_verifica_job($1::bigint,$2::uuid) valid', [job.id, job.token])
        if (r.rows[0].pid !== pid || !r.rows[0].valid || broken) throw fail()
      },
    }
    return { connection, close, evidence: { current_user: 'artecna_storage_worker_login', pooler_port: 5432,
      pid_before: pid, pid_after: after.rows[0].pid as number, same_pid: true,
      advisory_survived_commit: true, advisory_released: true } }
  } catch { await close(); throw fail() }
}
