/* eslint-disable @typescript-eslint/no-require-imports -- Native PostgreSQL fixture, loopback only. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { withNative } = require('./native.cjs')
const { certifiedInstallerFixture } = require('./installerBaseline.cjs')
const { seedRuntime } = require('./runtimeFixture.cjs')
const { alignAccountingAcl } = require('./contabilitaUsageFixture.cjs')

const load = name => fs.readFileSync(path.join(__dirname, '../../migrations', name), 'utf8').replace(/\r\n/g, '\n')
const migrazione = load('20261112000500_rapportini_stato_operativo.sql')
const leggi = 'SELECT public.leggi_stato_operativo_rapportino($1,$2) v'
const cambia = 'SELECT public.cambia_stato_operativo_rapportino($1,$2,$3,$4,$5) v'

test('stato operativo e hard delete V3 su PostgreSQL 17.6', { timeout: 180000 }, t => withNative(async (db, connect) => {
  const q = async (sql, args) => (await db.query(sql, args)).rows
  const admin = await connect('fixture_admin')
  for (const name of ['20261108000800_cantiere_hard_delete_finale.sql', '20261108000900_cantiere_hard_delete_runtime_v2.sql']) {
    await q(load(name))
  }
  await admin.query('ALTER ROLE postgres SUPERUSER')
  const f = await seedRuntime(db, 0)
  const { a: cantiere, u: owner } = f
  const esterno = randomUUID(), legacy = randomUUID(), bozza = randomUUID(), chiuso = randomUUID()
  await q('INSERT INTO auth.users(id) VALUES ($1)', [esterno])
  await q("INSERT INTO public.rapportini(id,cantiere_id,cantiere,data) VALUES ($1,$2,'Runtime target','2000-02-01')", [legacy,cantiere])
  await q(load('20261108001000_cantiere_hard_delete_runtime_v3.sql'))
  await alignAccountingAcl(db)
  await admin.query('ALTER ROLE postgres NOSUPERUSER CREATEROLE CREATEDB REPLICATION BYPASSRLS')
  await q(load('20261109001100_cantiere_delete_contabilita_schema_usage.sql'))
  const signature = () => q('SELECT artecna_distruzione.hard_delete_catalog() actual, signature expected FROM artecna_distruzione.hard_delete_catalog_expected').then(r => r[0])
  const before = await signature()
  assert.equal(before.actual, before.expected)

  await t.test('migrazione rifiuta deriva preesistente e preserva il controllo V3', async () => {
    await q('ALTER TABLE public.rapportini ADD COLUMN drift_fixture text')
    await assert.rejects(q(migrazione), { code: 'P2113' })
    await q('ROLLBACK')
    assert.equal((await q("SELECT count(*)::int n FROM pg_attribute WHERE attrelid='public.rapportini'::regclass AND attname='stato_operativo'"))[0].n, 0)
    await q('ALTER TABLE public.rapportini DROP COLUMN drift_fixture')
    assert.deepEqual(await signature(), before)
    await q(migrazione)
    const after = await signature()
    assert.equal(after.actual, after.expected)
    assert.notEqual(after.actual, before.actual)
    await q('BEGIN')
    try {
      await q('ALTER TABLE public.rapportini ADD COLUMN drift_fixture text')
      assert.deepEqual((await q('SELECT artecna_distruzione.hard_delete_blockers($1) v', [cantiere]))[0].v, ['catalogo'])
    } finally { await q('ROLLBACK') }
  })

  const a = await connect('fixture_admin')
  const b = await connect('fixture_admin')
  const actor = async (client, id) => {
    await client.query('BEGIN')
    await client.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [id])
    await client.query('SET LOCAL ROLE authenticated')
  }
  const as = async (id, sql, args, commit = false) => {
    await actor(a, id)
    try {
      const result = (await a.query(sql, args)).rows[0]?.v
      await a.query(commit ? 'COMMIT' : 'ROLLBACK')
      return result
    } catch (error) { await a.query('ROLLBACK'); throw error }
  }

  await t.test('legacy non classificato, retroattivo bozza, lettura con permessi esistenti e scrittura owner', async () => {
    assert.deepEqual(await as(owner, leggi, [legacy,cantiere]), { stato: null, revisione_stato: '0', revisione_documento: null })
    await q("INSERT INTO public.rapportini(id,cantiere_id,cantiere,data) VALUES ($1,$3,'Runtime target','2000-02-02'),($2,$3,'Runtime target','2000-02-03')", [bozza,chiuso,cantiere])
    assert.deepEqual(await as(esterno, leggi, [bozza,cantiere]), { stato: 'bozza', revisione_stato: '0', revisione_documento: null })
    await assert.rejects(as(esterno, cambia, [bozza,cantiere,'chiuso',0,null]), { code: '42501' })
    await assert.rejects(as(owner, "UPDATE public.rapportini SET stato_operativo='chiuso' WHERE id=$1", [bozza]), { code: '42501' })
    assert.equal((await as(owner,cambia,[chiuso,cantiere,'chiuso',0,null],true)).stato,'chiuso')
    assert.equal((await as(owner,cambia,[chiuso,cantiere,'bozza',1,null],true)).stato,'bozza')
    assert.equal((await as(owner,cambia,[chiuso,cantiere,'chiuso',2,null],true)).stato,'chiuso')
    assert.equal((await q('SELECT data::text AS data FROM public.rapportini WHERE id=$1',[chiuso]))[0].data,'2000-02-03')
    await actor(a,esterno)
    try {
      await a.query('RESET ROLE')
      await a.query('ALTER TABLE public.rapportini ENABLE ROW LEVEL SECURITY')
      await a.query('SET LOCAL ROLE authenticated')
      assert.equal((await a.query(leggi,[bozza,cantiere])).rows[0].v,null)
    } finally { await a.query('ROLLBACK') }
  })

  await t.test('due connessioni serializzano la chiusura, con PR412 e revisione documento invariata', async () => {
    const id = (await q("SELECT id FROM public.rapportini WHERE cantiere_id=$1 AND versione_prestazioni=1 ORDER BY data,id LIMIT 1", [cantiere]))[0].id
    const iniziale = await as(owner, leggi, [id,cantiere])
    const ids = [id,cantiere,'chiuso',iniziale.revisione_stato,iniziale.revisione_documento]
    await actor(a, owner)
    await actor(b, owner)
    try {
      const first = (await a.query(cambia,ids)).rows[0].v
      const pending = b.query(cambia,ids).then(() => 'OK', error => error.code)
      let waiting = false
      for (let i=0; i<50 && !waiting; i++) {
        waiting = (await admin.query("SELECT wait_event_type='Lock' AS v FROM pg_stat_activity WHERE pid=$1", [b.processID])).rows[0].v
        if (!waiting) await new Promise(resolve => setTimeout(resolve,20))
      }
      await a.query('COMMIT')
      assert.equal(waiting,true)
      assert.equal(await pending,'PR412')
      assert.equal(first.revisione_documento,iniziale.revisione_documento)
    } finally { await a.query('ROLLBACK'); await b.query('ROLLBACK') }
  })

  await t.test('eliminazione singola conserva la guardia allegati per tutti gli stati', async () => {
    const elimina = 'SELECT public.elimina_rapportino_legacy_senza_allegati($1) v'
    for (const id of [legacy,bozza,chiuso]) {
      await actor(a,owner)
      try {
        assert.equal((await a.query(elimina,[id])).rows[0].v.eliminato,true)
        assert.equal((await a.query('SELECT count(*)::int n FROM public.rapportini WHERE id=$1',[id])).rows[0].n,0)
      } finally { await a.query('ROLLBACK') }
    }
    const allegato = (await q('SELECT rapportino_id FROM artecna_rapportini.allegati WHERE cantiere_id=$1 LIMIT 1',[cantiere]))[0]
    await assert.rejects(as(owner,elimina,[allegato.rapportino_id]), { code: 'P2132' })
  })

  await t.test('hard delete legacy, bozza, chiuso e aggregati con prestazioni, foto e allegati senza orfani', async () => {
    const ids = (await q('SELECT id FROM public.rapportini WHERE cantiere_id=$1', [cantiere])).map(row => row.id)
    assert.ok(ids.includes(legacy) && ids.includes(bozza) && ids.includes(chiuso))
    const plan = (await q('SELECT artecna_distruzione.hard_delete_targets($1) v', [cantiere]))[0].v
    for (const table of ['public.rapportino_prestazioni','public.foto_cantiere','artecna_rapportini.allegati']) {
      assert.ok(plan[table].length, table)
    }
    assert.deepEqual((await q('SELECT artecna_distruzione.hard_delete_blockers($1,$2) v', [cantiere,plan]))[0].v, [])
    await actor(a,owner)
    try {
      assert.equal((await a.query("SELECT * FROM public.elimina_cantiere_definitivamente($1,'ELIMINA')",[cantiere])).rows[0].eliminato,true)
      await a.query('RESET ROLE')
      for (const table of ['public.rapportini','public.foto_cantiere','artecna_rapportini.allegati']) {
        assert.equal((await a.query('SELECT count(*)::int n FROM '+table+' WHERE cantiere_id=$1',[cantiere])).rows[0].n,0)
      }
      for (const table of ['public.rapportino_prestazioni','public.rapportino_materiali','public.timbrature','artecna_rapportini.richieste']) {
        assert.equal((await a.query('SELECT count(*)::int n FROM '+table+' WHERE rapportino_id=ANY($1::uuid[])',[ids])).rows[0].n,0,table)
      }
      assert.equal((await a.query('SELECT count(*)::int n FROM public.foto_cantiere WHERE rapportino_id=ANY($1::text[])',[ids])).rows[0].n,0)
    } finally { await a.query('ROLLBACK') }
  })
}, { productionActor: true, beforeMigrations: certifiedInstallerFixture }))
