// PostgreSQL 17 nativo, cluster temporaneo localhost. Nessuna ENV/connessione remota.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const net = require('node:net')
const { execFileSync } = require('node:child_process')
const { Client } = require('pg')
const migration = fs.readFileSync(path.resolve(__dirname,
  '../../../supabase/migrations/20261007_f3c1_storage_preventivi_policy.sql'), 'utf8')
const names = [
  ['Allow delete for authenticated users 1wl1hj8_0', 'DELETE'],
  ['Allow delete for authenticated users 1wl1hj8_1', 'SELECT'],
  ['allow all preventivi storage 1wl1hj8_0', 'SELECT'],
  ['allow all preventivi storage 1wl1hj8_1', 'INSERT'],
  ['allow all preventivi storage 1wl1hj8_2', 'UPDATE'],
  ['allow all preventivi storage 1wl1hj8_3', 'DELETE'],
]
const ident = s => '"' + s.replaceAll('"', '""') + '"'
const fixture = `DROP SCHEMA IF EXISTS storage CASCADE;
CREATE SCHEMA storage;
CREATE TABLE storage.objects(id integer PRIMARY KEY,bucket_id text NOT NULL);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO anon,authenticated;
INSERT INTO storage.objects VALUES(1,'preventivi'),(2,'altro'),(3,'rapportini-v1');
CREATE POLICY "full access preventivi" ON storage.objects AS PERMISSIVE FOR ALL TO anon USING(true) WITH CHECK(true);
${names.map(([name, cmd]) => `CREATE POLICY ${ident(name)} ON storage.objects AS PERMISSIVE FOR ${cmd} TO PUBLIC ${cmd === 'INSERT' ? 'WITH CHECK' : 'USING'}(bucket_id='preventivi');`).join('\n')}`
async function freePort() {
  const s = net.createServer()
  await new Promise((resolve, reject) => { s.once('error', reject); s.listen(0, '127.0.0.1', resolve) })
  const port = s.address().port
  await new Promise(resolve => s.close(resolve))
  return port
}
test('F3C1: PostgreSQL 17 isolato, cataloghi, rollback e RLS', async t => {
  const bin = process.env.F3C1_PG_BIN || path.join(os.tmpdir(), 'artecna-postgres17-minimal-runtime', 'pgsql', 'bin')
  const exe = name => path.join(bin, name + (process.platform === 'win32' ? '.exe' : ''))
  const version = execFileSync(exe('postgres'), ['--version'], { encoding: 'utf8', windowsHide: true })
  assert.match(version, /PostgreSQL\) 17\./, 'Richiesto PostgreSQL 17 reale')
  t.diagnostic(version.trim())
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'artecna-f3c1-'))
  const data = path.join(root, 'data')
  const port = await freePort()
  // pg_ctl deve avere stream chiusi: su Windows il server può ereditare pipe
  // e impedire il ritorno di execFileSync anche dopo startup completato.
  const run = (name, args) => execFileSync(exe(name), args, { stdio: 'ignore', windowsHide: true, timeout: 60000 })
  let started = false
  let db
  try {
    run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale', '-E', 'UTF8'])
    run('pg_ctl', ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start'])
    started = true
    db = new Client({ host: '127.0.0.1', port, user: 'postgres', database: 'postgres' })
    await db.connect()
    await db.query('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;')
    const snapshot = async () => (await db.query(`SELECT
      (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE polrelid='storage.objects'::regclass) policies,
      (SELECT to_jsonb(c) FROM pg_class c WHERE oid='storage.objects'::regclass) relation,
      (SELECT to_jsonb(n) FROM pg_namespace n WHERE nspname='storage') schema`)).rows[0]
    const reset = () => db.query(fixture)
    await t.test('baseline esatta: solo due predicati cambiano, stesso OID e ACL', async () => {
      await reset()
      const before = await snapshot()
      await db.query(migration)
      const after = await snapshot()
      const target = after.policies.find(p => p.polname === 'full access preventivi')
      const original = before.policies.find(p => p.polname === target.polname)
      assert.notEqual(target.polqual, original.polqual)
      assert.notEqual(target.polwithcheck, original.polwithcheck)
      const normalized = structuredClone(after)
      Object.assign(normalized.policies.find(p => p.oid === target.oid), {
        polqual: original.polqual, polwithcheck: original.polwithcheck,
      })
      assert.deepEqual(normalized, before)
    })
    const cases = [
      ['policy assente', 'DROP POLICY "full access preventivi" ON storage.objects'],
      ['omonima su altra tabella non sostituisce target', `DROP POLICY "full access preventivi" ON storage.objects; CREATE TABLE storage.other(bucket_id text); CREATE POLICY "full access preventivi" ON storage.other USING(true) WITH CHECK(true)`],
      ['ruolo diverso', 'ALTER POLICY "full access preventivi" ON storage.objects TO authenticated'],
      ['ruolo aggiuntivo', 'ALTER POLICY "full access preventivi" ON storage.objects TO anon,authenticated'],
      ['comando diverso', 'DROP POLICY "full access preventivi" ON storage.objects; CREATE POLICY "full access preventivi" ON storage.objects FOR SELECT TO anon USING(true)'],
      ['target restrictive', 'DROP POLICY "full access preventivi" ON storage.objects; CREATE POLICY "full access preventivi" ON storage.objects AS RESTRICTIVE TO anon USING(true) WITH CHECK(true)'],
      ['USING diverso', 'ALTER POLICY "full access preventivi" ON storage.objects USING(false)'],
      ['WITH CHECK diverso', 'ALTER POLICY "full access preventivi" ON storage.objects WITH CHECK(false)'],
      ['altra policy mancante', `DROP POLICY ${ident(names[0][0])} ON storage.objects`],
      ['altra policy aggiunta', 'CREATE POLICY unexpected ON storage.objects USING(true)'],
      ['altra policy predicato modificato', `ALTER POLICY ${ident(names[0][0])} ON storage.objects USING(true)`],
      ['altra policy ruolo modificato', `ALTER POLICY ${ident(names[0][0])} ON storage.objects TO authenticated`],
      ['restrictive inattesa', 'CREATE POLICY unexpected ON storage.objects AS RESTRICTIVE USING(true)'],
      ['RLS disattivata', 'ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY'],
    ]
    for (const [label, mutation] of cases) await t.test(label + ': abort senza cambiamenti', async () => {
      await reset()
      await db.query(mutation)
      const before = await snapshot()
      await assert.rejects(() => db.query(migration), e => e.code === 'P0001' && /F3C1/.test(e.message))
      await db.query('ROLLBACK')
      assert.deepEqual(await snapshot(), before)
    })
    await t.test('duplicato sulla stessa tabella impossibile: catalogo lo rifiuta', async () => {
      await reset()
      await assert.rejects(() => db.query('CREATE POLICY "full access preventivi" ON storage.objects USING(true)'), e => e.code === '42710')
    })
    for (const [label, injected] of [
      ['errore esplicito', "RAISE EXCEPTION 'F3C1: errore post-check iniettato';"],
      ['RLS', 'ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;'],
      ['ACL tabella', 'REVOKE SELECT ON storage.objects FROM anon;'],
      ['ACL schema', 'REVOKE USAGE ON SCHEMA storage FROM anon;'],
      ['altra policy', `ALTER POLICY ${ident(names[0][0])} ON storage.objects USING(true);`],
      ['nuova policy', 'CREATE POLICY unexpected ON storage.objects USING(true);'],
      ['target ruolo', 'ALTER POLICY "full access preventivi" ON storage.objects TO authenticated;'],
    ]) await t.test('post-check ' + label + ': rollback totale', async () => {
      await reset()
      const before = await snapshot()
      const faulty = migration.replace('-- F3C1_POSTCHECK:', injected + '\n  -- F3C1_POSTCHECK:')
      await assert.rejects(() => db.query(faulty), e => e.code === 'P0001' && /F3C1/.test(e.message))
      await db.query('ROLLBACK')
      assert.deepEqual(await snapshot(), before)
    })
    await t.test('seconda applicazione abortisce, non idempotenza silenziosa', async () => {
      await reset(); await db.query(migration)
      const before = await snapshot()
      await assert.rejects(() => db.query(migration), e => e.code === 'P0001')
      await db.query('ROLLBACK'); assert.deepEqual(await snapshot(), before)
    })
    const rls = async role => {
      await db.query('SET ROLE ' + role)
      try {
        assert.deepEqual((await db.query('SELECT bucket_id FROM storage.objects ORDER BY id')).rows, [{ bucket_id: 'preventivi' }])
        await db.query("INSERT INTO storage.objects VALUES(4,'preventivi')")
        await db.query("UPDATE storage.objects SET id=5 WHERE id=4")
        for (const bucket of ['altro', 'rapportini-v1']) {
          await assert.rejects(() => db.query('INSERT INTO storage.objects VALUES(9,$1)', [bucket]), e => e.code === '42501')
          await assert.rejects(() => db.query('UPDATE storage.objects SET bucket_id=$1 WHERE id=5', [bucket]), e => e.code === '42501')
          assert.equal((await db.query('DELETE FROM storage.objects WHERE bucket_id=$1', [bucket])).rowCount, 0)
        }
        assert.equal((await db.query('DELETE FROM storage.objects WHERE id=5')).rowCount, 1)
      } finally { await db.query('RESET ROLE') }
    }
    await t.test('anon: target da sola conserva CRUD preventivi e nega altri bucket', async () => {
      await reset(); await db.query(migration)
      for (const [name] of names) await db.query(`DROP POLICY ${ident(name)} ON storage.objects`)
      await rls('anon')
    })
    await t.test('authenticated: sei policy PUBLIC, nessuna eredità anon', async () => {
      await reset(); await db.query(migration)
      assert.equal((await db.query("SELECT pg_has_role('authenticated','anon','USAGE') v")).rows[0].v, false)
      await db.query('DROP POLICY "full access preventivi" ON storage.objects')
      await rls('authenticated')
    })
    await t.test('inventario completo: anon e authenticated', async () => {
      for (const role of ['anon', 'authenticated']) { await reset(); await db.query(migration); await rls(role) }
    })
  } finally {
    if (db) await db.end()
    if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
    // Directory creata da questo test; nessun percorso esterno viene eliminato.
    const resolved = path.resolve(root)
    if (resolved.startsWith(path.resolve(os.tmpdir()) + path.sep)
      && path.basename(resolved).startsWith('artecna-f3c1-')) {
      fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
    }
  }
})
