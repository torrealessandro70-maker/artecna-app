import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import type { ClientConfig } from 'pg'
import { configuredStorageRemover } from './storageRemoval.server'
import { openStorageSession, storageConnectionConfig } from './storageSession.server'
import { consumeStorageJob, type StorageRemover, type WorkerConnection } from './storageWorker.server'

export const STORAGE_BATCH_DEFAULT = 1
export const STORAGE_BATCH_MAX = 2
export const STORAGE_BUDGET_MS = 45_000
// Leave enough time for the remover's 20s timeout, verification, ack and close.
export const STORAGE_JOB_RESERVE_MS = 32_000
type Evidence = Awaited<ReturnType<typeof openStorageSession>>['evidence']
type Session = { connection: WorkerConnection; close(): Promise<void>; evidence?: Evidence }
export async function runStorageBatch(open: () => Promise<Session>, storage: StorageRemover | undefined,
  options: { gate: boolean; limit: number; probe?: () => Promise<{ ok: true; operation: 'list_buckets' }> }, now = () => performance.now()) {
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > STORAGE_BATCH_MAX || (!options.gate && !storage)) throw new Error('STORAGE_CONFIGURATION_UNAVAILABLE')
  const start = now(), session = await open(), outcomes: string[] = []
  // Close the physical session at the invocation budget even if a DB operation
  // stalls. An in-flight HTTP call retains its own 20s abort deadline; immutable
  // keys make a late response safe and the lease remains recoverable.
  const deadline = setTimeout(() => { void session.close() }, Math.max(1, STORAGE_BUDGET_MS - (now() - start)))
  try {
    if (options.gate) {
      const e = session.evidence
      if (!e || !Number.isInteger(e.pid_before) || e.pid_before <= 0 || e.pid_before !== e.pid_after
        || e.same_pid !== true || e.advisory_survived_commit !== true || e.advisory_released !== true
        || e.current_user !== 'artecna_storage_worker_login' || e.pooler_port !== 5432 || !options.probe) throw new Error('STORAGE_GATE_UNAVAILABLE')
      const probe = await options.probe()
      if (probe.ok !== true || probe.operation !== 'list_buckets') throw new Error('STORAGE_GATE_UNAVAILABLE')
      return { mode: 'gate', ok: true, ...e, storage_probe: { ok: true, operation: 'list_buckets' }, no_claim: true, no_storage_delete: true }
    }
    if (!options.gate) for (let i = 0; i < options.limit && now() - start < STORAGE_BUDGET_MS - STORAGE_JOB_RESERVE_MS; i++) {
      const outcome = await consumeStorageJob({ connect: async () => session.connection }, storage!)
      outcomes.push(outcome)
      if (outcome === 'idle') break
    }
    return { gate: 'SESSION_OK', outcomes }
  } finally { clearTimeout(deadline); await session.close() }
}

/** Machine/admin invocation only. No cookie/browser authentication, secret logs,
 * public job IDs or caller-supplied Storage identities. No additional auth secret. */
export function createStorageCleanupHandler(dependencies: {
  secret?: string; databaseUrl?: string; open(config: ClientConfig): Promise<Session>; remover(): StorageRemover | undefined
  probe?: () => Promise<{ ok: true; operation: 'list_buckets' }>
}) { return async (req: Request) => {
  const reply = (value: object, status: number) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
  const secret = dependencies.secret, bearer = req.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]
  if (!secret) return reply({ code: 'STORAGE_CONFIGURATION_UNAVAILABLE' }, 503)
  if (!bearer || !timingSafeEqual(createHash('sha256').update(secret).digest(), createHash('sha256').update(bearer).digest())) return reply({ code: 'UNAUTHORIZED' }, 401)
  try {
    // Bounded parameters in query string; request bodies never read/buffered.
    const params = new URL(req.url).searchParams
    if ([...params.keys()].some(k => !['mode', 'limit'].includes(k)) || [...params.keys()].some(k => params.getAll(k).length !== 1)) return reply({ code: 'INVALID_REQUEST' }, 400)
    const mode = params.get('mode') ?? 'gate', limit = Number(params.get('limit') ?? STORAGE_BATCH_DEFAULT)
    if (!['gate', 'run'].includes(mode) || !Number.isInteger(limit) || limit < 1 || limit > STORAGE_BATCH_MAX) return reply({ code: 'INVALID_REQUEST' }, 400)
    const config = storageConnectionConfig(dependencies.databaseUrl)
    const result = await runStorageBatch(() => dependencies.open(config), mode === 'gate' ? undefined : dependencies.remover(), { gate: mode === 'gate', limit, probe: dependencies.probe })
    return reply(result, 200)
  } catch { return reply({ code: 'STORAGE_WORKER_UNAVAILABLE' }, 503) }
} }

export async function storageCleanupPOST(req: Request) {
  return createStorageCleanupHandler({ secret: process.env.SUPABASE_SERVICE_ROLE_KEY,
    databaseUrl: process.env.STORAGE_CLEANUP_DATABASE_URL, open: openStorageSession, remover: configuredStorageRemover,
    probe: async () => {
      const storage = configuredStorageRemover()
      if (!storage) throw new Error('STORAGE_CONFIGURATION_UNAVAILABLE')
      return storage.probe()
    } })(req)
}
