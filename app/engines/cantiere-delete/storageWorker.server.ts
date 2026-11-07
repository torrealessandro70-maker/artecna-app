import 'server-only'

export interface StorageJob {
  id: string | number; bucket: string; path: string; token: string; lock_key: string; attempt: number
}
export interface WorkerConnection {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
  release(error?: Error): void
}
export interface WorkerPool { connect(): Promise<WorkerConnection> }
export interface StorageRemover {
  remove(bucket: string, path: string): Promise<{ ok: true } | { ok: false; permanent: boolean; reason: string }>
}

/** Requires a checked-out SESSION connection, never a transaction-mode pooler.
 * The DB advisory lock stays on this connection throughout the external call.
 * Tombstoned keys are never reopened, including after failures and expired leases.
 * No scheduler/HTTP endpoint or production invocation is introduced here. */
export async function consumeStorageJob(pool: WorkerPool, storage: StorageRemover): Promise<'idle' | 'completed' | 'retry' | 'failed'> {
  const db = await pool.connect()
  let job: StorageJob | undefined, broken: Error | undefined
  try {
    await db.query('BEGIN')
    const result = await db.query('SELECT artecna_distruzione.storage_claim() AS job')
    const candidate = result.rows[0]?.job
    if (candidate !== null && candidate !== undefined) {
      if (typeof candidate !== 'object') throw new Error('Invalid Storage claim')
      job = candidate as StorageJob
      if (!/^-?\d+$/.test(job.lock_key) || typeof job.bucket !== 'string' || !job.bucket
        || typeof job.path !== 'string' || !job.path || typeof job.token !== 'string') throw new Error('Invalid Storage claim')
    }
    await db.query('COMMIT')
    if (!job) return 'idle'
    let outcome: Awaited<ReturnType<StorageRemover['remove']>>
    try { outcome = await storage.remove(job.bucket, job.path) }
    catch { outcome = { ok: false, permanent: false, reason: 'STORAGE_TRANSPORT' } }
    await db.query('BEGIN')
    await db.query('SELECT artecna_distruzione.storage_finish($1::bigint,$2::uuid,$3::boolean,$4::boolean,$5::text)',
      [job.id, job.token, outcome.ok, outcome.ok ? false : outcome.permanent, outcome.ok ? null : outcome.reason])
    await db.query('COMMIT')
    return outcome.ok ? 'completed' : outcome.permanent ? 'failed' : 'retry'
  } catch (error) {
    broken = new Error('Storage worker connection outcome uncertain')
    try { await db.query('ROLLBACK') } catch { /* destroy below */ }
    // Never mark complete after a DB/transport ambiguity. Expired lease retry
    // uses the same immutable object identity; absent object is idempotent.
    throw error
  } finally {
    if (job) {
      try { await db.query('SELECT pg_catalog.pg_advisory_unlock($1::bigint)', [job.lock_key]) }
      catch { broken = new Error('Storage session lock release uncertain') }
    }
    // A lost claim response may have acquired a session lock without returning
    // the key: destroy, never return that connection to the pool.
    db.release(broken)
  }
}
