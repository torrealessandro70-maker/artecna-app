/* eslint-disable @typescript-eslint/no-require-imports -- Native PostgreSQL fixture, loopback only. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { withNative } = require('./native.cjs')
const { certifiedInstallerFixture } = require('./installerBaseline.cjs')
const { alignAccountingAcl } = require('./contabilitaUsageFixture.cjs')
const { seedRuntime } = require('./runtimeFixture.cjs')

const root = path.resolve(__dirname, '../../..')
const migration = name => fs.readFileSync(path.join(root, 'supabase/migrations', name), 'utf8').replace(/\r\n/g, '\n')
const align = migration('20261112000401_hard_delete_v3_firma_notifiche.sql')
const validator = fs.readFileSync(path.join(__dirname, 'hard-delete-v3-firma-notifiche-readonly.sql'), 'utf8')
const productionBefore = 'ecab5c38a5d6ac48d190bbe99cd5a740'
const productionAfter = '111feadfb0a82a15caf9fbcf53e0c1b6'

test('riallineamento hard delete V3 su PostgreSQL 17.6, fail-closed e una sola riga', { timeout: 180000 }, t =>
  withNative(async (db, connect) => {
    const q = async (sql, args) => (await db.query(sql, args)).rows
    const admin = await connect('fixture_admin')
    for (const name of ['20261108000800_cantiere_hard_delete_finale.sql', '20261108000900_cantiere_hard_delete_runtime_v2.sql']) {
      await q(migration(name))
    }
    await admin.query('ALTER ROLE postgres SUPERUSER')
    const { a: cantiere } = await seedRuntime(db, 0)
    await q(migration('20261108001000_cantiere_hard_delete_runtime_v3.sql'))
    await alignAccountingAcl(db)
    await admin.query('ALTER ROLE postgres NOSUPERUSER CREATEROLE CREATEDB REPLICATION BYPASSRLS')
    await q(migration('20261109001100_cantiere_delete_contabilita_schema_usage.sql'))
    await q(fs.readFileSync(path.join(root, 'supabase/validators/scadenziario/documenti-storage-fixture.sql'), 'utf8'))
    for (const name of [
      '20261110000100_scadenziario_fiscale_persistenza.sql',
      '20261111000100_documenti_fiscali_privati.sql',
      '20261112000100_notifiche_in_app_scadenziario.sql',
    ]) {
      if (name.startsWith('20261112000100')) {
        // Reproduce the registered pre-notifications state on the synthetic schema.
        // Production's registered fingerprint already includes the fiscal prerequisites.
        await q('UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()')
        const baseline = await signature()
        assert.equal(baseline.actual, baseline.registered)
      }
      await q(migration(name))
    }
    const scheduler = migration('20261112000200_notifiche_scheduler.sql')
    const wrapper = scheduler.match(/CREATE OR REPLACE FUNCTION artecna_notifiche\.esegui_generatore_runtime\(\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/)?.[0]
    assert.ok(wrapper)
    // The disposable cluster has no pg_cron daemon. Install the exact runtime
    // wrapper, then the Agenda and Sopralluoghi schema migrations.
    await q(wrapper)
    for (const name of ['20261112000300_notifiche_agenda.sql', '20261112000400_notifiche_sopralluoghi.sql']) await q(migration(name))

    async function signature() {
      return (await q('SELECT artecna_distruzione.hard_delete_catalog() AS actual, signature AS registered FROM artecna_distruzione.hard_delete_catalog_expected'))[0]
    }
    const before = await signature()
    assert.notEqual(before.actual, before.registered)
    const blockers = async () => (await q('SELECT artecna_distruzione.hard_delete_blockers($1,artecna_distruzione.hard_delete_targets($1)) AS reasons', [cantiere]))[0].reasons
    assert.deepEqual(await blockers(), ['catalogo'])
    const fixtureSql = sql => sql.replace(productionBefore, before.registered).replace(productionAfter, before.actual)
    const snapshot = async () => (await q(String.raw`SELECT jsonb_build_object(
      'rapportini',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.rapportini r),
      'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attnum) FROM pg_attribute a WHERE attrelid='public.rapportini'::regclass),
      'fks',(SELECT jsonb_agg(pg_get_constraintdef(oid,true) ORDER BY conname) FROM pg_constraint
        WHERE conname IN ('notifica_recipient_user_id_fkey','preferenze_notifiche_user_id_fkey')),
      'guardie',(SELECT jsonb_agg(pg_get_functiondef(oid) ORDER BY oid) FROM pg_proc
        WHERE proname IN ('hard_delete_catalog','hard_delete_blockers','elimina_cantiere_definitivamente'))
      ) AS state`))[0].state
    const original = await snapshot()

    await t.test('la migrazione Production esatta rifiuta la firma diversa della fixture', async () => {
      await assert.rejects(q(align), { code: 'P2113', message: 'Firma registrata divergente' })
      await q('ROLLBACK')
      assert.deepEqual(await signature(), before)
    })
    await t.test('il validator read-only certifica le due sole FK prima e dopo il cambio di firma', async () => {
      await q(fixtureSql(validator))
      assert.deepEqual(await signature(), before)
      await q(fixtureSql(align))
      assert.deepEqual(await signature(), { actual: before.actual, registered: before.actual })
      await q(fixtureSql(validator))
      assert.deepEqual(await blockers(), [])
      assert.deepEqual(await snapshot(), original)
      assert.equal(original.fks.length, 2)
    })
    await t.test('secondo apply e drift reale vengono ancora rifiutati', async () => {
      await assert.rejects(q(fixtureSql(align)), { code: 'P2113', message: 'Firma registrata divergente' })
      await q('ROLLBACK')
      await q('BEGIN')
      try {
        await q('ALTER TABLE public.rapportini ADD COLUMN drift_fixture text')
        assert.deepEqual(await blockers(), ['catalogo'])
      } finally { await q('ROLLBACK') }
      assert.deepEqual(await blockers(), [])
      assert.deepEqual(await snapshot(), original)
    })
  }, { productionActor: true, beforeMigrations: certifiedInstallerFixture }))

