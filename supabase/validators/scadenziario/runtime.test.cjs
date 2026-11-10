/* eslint-disable @typescript-eslint/no-require-imports -- Native PostgreSQL 17.6, loopback-only disposable cluster. No Production configuration is read. */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), net = require('node:net'), cp = require('node:child_process'), crypto = require('node:crypto'), { Client } = require('pg'), ts = require('typescript')
const { controller } = require('../../../app/components/scadenziarioControllerFixture.cjs')
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, f)
const { creaArchivioScadenziario } = require('../../../app/engines/contabilita-ditta/scadenziarioPersistenza.ts')
const { riepilogaScadenze } = require('../../../app/engines/contabilita-ditta/scadenziario.ts')
const root = path.resolve(__dirname, '../../..'), migration = '20261110000100_scadenziario_fiscale_persistenza.sql'
const binary = path.resolve(root, '../cantiere-hard-delete-runtime/.run/cantiere-prereq-runtime/minimal/pgsql/bin')
const uid = '00000000-0000-4000-8000-000000000001', outsider = '00000000-0000-4000-8000-000000000002'
const base = (extra = {}) => ({ tipo: 'IVA', periodo_riferimento: crypto.randomUUID(), data_scadenza: '2026-12-01', importo_previsto: null, stato: 'da_verificare', importo_pagato: null, data_pagamento: null, note: '', riferimento_documento: 'fixture', includi_nei_totali: true, ...extra })
const sha = s => crypto.createHash('sha256').update(s).digest('hex')
const declarations = {
  leggi_scadenze_fiscali: ['p_includi_archiviate'], crea_scadenza_fiscale: ['p_id', 'p_dati'],
  aggiorna_scadenza_fiscale: ['p_id', 'p_revisione_attesa', 'p_dati'], archivia_scadenza_fiscale: ['p_id', 'p_revisione_attesa', 'p_motivo'],
}

test('scadenziario DB locale reale PostgreSQL 17.6', { timeout: 900000 }, async () => {
  const artifact = fs.mkdtempSync(path.join(root, '.run/scadenziario/db-gate/cluster-')), data = path.join(artifact, 'data')
  const report = { directory: artifact, production_connections: 0, apply_count: 0, checks: [], concurrency: [], sql_files: [], stopped: false }
  const environment = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^PG/i.test(k)))
  const exec = (name, args, extra = {}) => cp.execFileSync(path.join(binary, name + '.exe'), args, { encoding: 'utf8', windowsHide: true, timeout: 60000, env: environment, ...extra })
  const connections = []; let started = false, config, db, admin
  const connect = async (user = 'postgres') => {
    assert.equal(config.host, '127.0.0.1')
    const c = new Client({ ...config, user, password: 'LOCAL_FIXTURE_UNUSED', ssl: false, connectionTimeoutMillis: 5000 })
    c.on('error', () => {}); await c.connect(); connections.push(c); return c
  }
  const check = async (name, fn) => { try { await fn(); report.checks.push({ name, pass: true }); console.log('PASS ' + name) } catch (error) { report.checks.push({ name, pass: false, error: error.message }); throw error } }
  const callOn = async (client, name, args) => {
    assert(name in declarations); const keys = declarations[name]
    const values = keys.map(k => args[k]); const query = 'SELECT public.' + name + '(' + keys.map((_, i) => '$' + (i + 1)).join(',') + ') AS data'
    return (await client.query(query, values)).rows[0].data
  }
  const rawCall = async (name, args, role = 'authenticated', userId = uid) => {
    const c = await connect('fixture_admin')
    try { await c.query('BEGIN'); await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [userId]); await c.query('SET LOCAL ROLE ' + (role === 'anon' ? 'anon' : 'authenticated')); const r = await callOn(c, name, args); await c.query('COMMIT'); return r }
    catch (e) { await c.query('ROLLBACK'); throw e } finally { await c.end(); connections.splice(connections.indexOf(c), 1) }
  }
  const create = async (d = base(), id = crypto.randomUUID()) => ({ d, id, row: await rawCall('crea_scadenza_fiscale', { p_id: id, p_dati: d }) })
  const expectCode = (promise, code) => assert.rejects(promise, e => e.code === code)
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations', migration), 'utf8')
  try {
    report.binary_version = exec('postgres', ['--version']).trim(); assert.equal(report.binary_version, 'postgres (PostgreSQL) 17.6')
    const listener = net.createServer(); await new Promise((r, j) => { listener.once('error', j); listener.listen(0, '127.0.0.1', r) }); const port = listener.address().port; await new Promise(r => listener.close(r))
    config = { host: '127.0.0.1', port, database: 'postgres' }; report.connection = config
    exec('initdb', ['-D', data, '-U', 'fixture_admin', '-A', 'trust', '--no-locale', '-E', 'UTF8'])
    exec('pg_ctl', ['-D', data, '-l', path.join(artifact, 'server.log'), '-o', `-h 127.0.0.1 -p ${port} -F -c max_connections=20`, '-w', 'start'], { stdio: 'ignore' }); started = true
    admin = await connect('fixture_admin'); await admin.query('CREATE ROLE postgres LOGIN SUPERUSER'); await admin.query('ALTER DATABASE postgres OWNER TO postgres'); db = await connect()
    const baselinePath = path.join(root, 'supabase/validators/cantiere-prerequisiti/baseline.sql'), baseline = fs.readFileSync(baselinePath, 'utf8')
    report.baseline_sha256 = sha(baseline); await db.query(baseline); await db.query('SET check_function_bodies=on')
    report.version = (await db.query("SELECT current_setting('server_version') AS version,current_setting('server_version_num') AS num,host(inet_server_addr()) AS host")).rows[0]
    assert.equal(report.version.num, '170006'); assert.equal(report.version.host, '127.0.0.1')
    await db.query('INSERT INTO auth.users(id) VALUES($1),($2)', [uid, outsider]); await db.query("INSERT INTO public.utenti_impresa(user_id,ruolo,attivo) VALUES($1,'titolare',true)", [uid])
    const guards = () => db.query("SELECT oid::regprocedure::text AS signature,md5(pg_get_functiondef(oid)) AS hash,proacl::text AS acl FROM pg_proc WHERE oid IN('artecna_guardie.utente_jwt_corrente()'::regprocedure,'artecna_guardie.utente_puo_operare_impresa(uuid)'::regprocedure) ORDER BY 1")
    const before = (await guards()).rows
    await admin.query('ALTER ROLE postgres NOSUPERUSER CREATEROLE CREATEDB REPLICATION BYPASSRLS')
    report.actor = (await db.query("SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0]
    await check('migration one-shot compiled with check_function_bodies=on', async () => { report.apply_count++; assert.equal(report.apply_count, 1); await db.query(sql); report.migration_sha256 = sha(sql) })
    assert.deepEqual((await guards()).rows, before)
    const psql = (file, vars = {}) => {
      const args = ['-X', '-w', '-h', '127.0.0.1', '-p', String(port), '-U', 'fixture_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
      for (const [key, value] of Object.entries(vars)) args.push('-v', key + '=' + value)
      args.push('-f', path.join(__dirname, file)); const out = exec('psql', args); fs.writeFileSync(path.join(artifact, file + '.log'), out); report.sql_files.push({ file, pass: true }); return out
    }
    await check('prepared structure SQL validator', () => assert(psql('struttura-readonly.sql').includes('GREEN_SCADENZIARIO_STRUCTURE')))
    await check('prepared contract SQL validator', () => assert(psql('contratto-locale.sql', { test_titolare: uid, test_esterno: outsider }).includes('GREEN_SCADENZIARIO_LOCAL_CONTRACT')))
    await check('guard definitions/ACL unchanged', async () => assert.deepEqual((await guards()).rows, before))
    const counts = () => db.query("SELECT 'pagamenti_operai' AS tabella,count(*)::int AS n FROM public.pagamenti_operai UNION ALL SELECT 'pagamenti_fornitori',count(*)::int FROM public.pagamenti_fornitori UNION ALL SELECT 'spese_impresa',count(*)::int FROM public.spese_impresa UNION ALL SELECT 'incassi_non_fatturati',count(*)::int FROM public.incassi_non_fatturati ORDER BY 1")
    const lateralBefore = (await counts()).rows
    await check('anon and non-company cannot call any RPC', async () => {
      for (const [name, args] of Object.entries({ leggi_scadenze_fiscali: { p_includi_archiviate: false }, crea_scadenza_fiscale: { p_id: crypto.randomUUID(), p_dati: base() }, aggiorna_scadenza_fiscale: { p_id: crypto.randomUUID(), p_revisione_attesa: '0', p_dati: base() }, archivia_scadenza_fiscale: { p_id: crypto.randomUUID(), p_revisione_attesa: '0', p_motivo: 'fixture' } })) {
        await expectCode(rawCall(name, args, 'anon'), '42501'); await expectCode(rawCall(name, args, 'authenticated', outsider), '42501')
      }
    })
    await check('missing/inactive JWT fails closed', async () => {
      await expectCode(rawCall('leggi_scadenze_fiscali', { p_includi_archiviate: false }, 'authenticated', ''), '42501')
      await db.query('UPDATE public.utenti_impresa SET attivo=false WHERE user_id=$1', [uid])
      try { await expectCode(rawCall('leggi_scadenze_fiscali', { p_includi_archiviate: false }), '42501') } finally { await db.query('UPDATE public.utenti_impresa SET attivo=true WHERE user_id=$1', [uid]) }
    })
    await check('reader starts empty and create uses JWT, preserves NULL versus zero', async () => {
      assert.equal((await rawCall('leggi_scadenze_fiscali', { p_includi_archiviate: false })).totale, 0)
      const a = await create(), b = await create(base({ importo_previsto: '0.00' }))
      assert.equal(a.row.created_by, uid); assert.equal(a.row.updated_by, uid); assert.equal(a.row.importo_previsto, null); assert.equal(b.row.importo_previsto, '0.00')
    })
    await check('idempotent UUID create is deterministic, never duplicates or overwrites', async () => {
      const a = await create(); const again = await rawCall('crea_scadenza_fiscale', { p_id: a.id, p_dati: a.d }); assert.deepEqual(again, a.row)
      await expectCode(rawCall('crea_scadenza_fiscale', { p_id: a.id, p_dati: { ...a.d, note: 'changed' } }), '23505')
      await rawCall('aggiorna_scadenza_fiscale', { p_id: a.id, p_revisione_attesa: '0', p_dati: { ...a.d, note: 'revision one' } })
      await expectCode(rawCall('crea_scadenza_fiscale', { p_id: a.id, p_dati: a.d }), '23505')
      assert.equal((await db.query('SELECT count(*)::int AS n FROM artecna_contabilita.scadenze_fiscali WHERE id=$1', [a.id])).rows[0].n, 1)
    })
    await check('negative/overprecision/invalid state/client actors rejected', async () => {
      for (const change of [{ importo_previsto: '-1' }, { importo_pagato: '-1' }, { importo_previsto: '1.001' }, { stato: 'archiviato' }, { created_by: outsider }, { updated_by: outsider }]) await expectCode(rawCall('crea_scadenza_fiscale', { p_id: crypto.randomUUID(), p_dati: base(change) }), '22023')
    })
    for (const action of ['aggiorna_scadenza_fiscale', 'archivia_scadenza_fiscale']) await check('real two-backend collision: ' + action, async () => {
      const fixture = await create(); const a = await connect('fixture_admin'), b = await connect('fixture_admin');
      for (const c of [a, b]) { await c.query('BEGIN'); await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [uid]); await c.query('SET LOCAL ROLE authenticated') }
      const pidA = (await a.query('SELECT pg_backend_pid() AS pid')).rows[0].pid, pidB = (await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid; assert.notEqual(pidA, pidB)
      const readA = await callOn(a, 'leggi_scadenze_fiscali', { p_includi_archiviate: false }), readB = await callOn(b, 'leggi_scadenze_fiscali', { p_includi_archiviate: false })
      assert.equal(readA.righe.find(r => r.id === fixture.id).revisione, '0'); assert.equal(readB.righe.find(r => r.id === fixture.id).revisione, '0')
      const args = action === 'aggiorna_scadenza_fiscale' ? { p_id: fixture.id, p_revisione_attesa: '0', p_dati: { ...fixture.d, note: 'winner A' } } : { p_id: fixture.id, p_revisione_attesa: '0', p_motivo: 'winner A' }
      await callOn(a, action, args)
      const waiting = callOn(b, action, args).then(() => ({ code: 'UNEXPECTED_SUCCESS' }), e => ({ code: e.code }))
      let blocked = false; for (let attempt = 0; attempt < 100; attempt++) { const q = await admin.query("SELECT wait_event_type='Lock' AS blocked FROM pg_stat_activity WHERE pid=$1", [pidB]); if (q.rows[0]?.blocked) { blocked = true; break } await new Promise(r => setTimeout(r, 20)) }
      assert(blocked, 'B must really wait for the row lock'); await a.query('COMMIT'); const outcome = await waiting; assert.equal(outcome.code, '40001'); await b.query('ROLLBACK')
      const stored = (await db.query('SELECT revisione::text,note,motivo_archiviazione FROM artecna_contabilita.scadenze_fiscali WHERE id=$1', [fixture.id])).rows[0]
      assert.equal(stored.revisione, '1'); assert.equal(action === 'aggiorna_scadenza_fiscale' ? stored.note : stored.motivo_archiviazione, 'winner A')
      report.concurrency.push({ action, pidA, pidB, both_read_revision: '0', a: 'SUCCESS', b: outcome.code, actual_lock_wait: blocked, retries: 0 })
    })
    await check('prepared concurrency A/B SQL scripts executed with independent psql backends', async () => {
      const row = await create(), children = [], records = []
      const launch = (file, appName) => {
        const args = ['-X', '-w', '-h', '127.0.0.1', '-p', String(port), '-U', 'fixture_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'test_titolare=' + uid, '-v', 'test_id=' + row.id, '-v', 'test_revisione=0', '-f', path.join(__dirname, file)]
        const child = cp.spawn(path.join(binary, 'psql.exe'), args, { windowsHide: true, env: { ...environment, PGAPPNAME: appName }, stdio: ['pipe', 'pipe', 'pipe'] })
        const record = { file, stdout: '', stderr: '' }; children.push(child); records.push(record)
        child.stdout.on('data', b => { record.stdout += b.toString() }); child.stderr.on('data', b => { record.stderr += b.toString() })
        record.done = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code)) }); return { child, record }
      }
      try {
        const a = launch('concorrenza-A.sql', 'scadenziario-concurrency-A')
        let prompted = false; for (let i = 0; i < 300; i++) { if (a.record.stdout.includes('Avviare B')) { prompted = true; break } await new Promise(r => setTimeout(r, 20)) }
        assert(prompted, a.record.stderr || 'A must hold its transaction at the prompt')
        const b = launch('concorrenza-B.sql', 'scadenziario-concurrency-B')
        let blocked = false; for (let i = 0; i < 300; i++) { const s = await admin.query("SELECT wait_event_type FROM pg_stat_activity WHERE application_name='scadenziario-concurrency-B'"); if (s.rows.some(r => r.wait_event_type === 'Lock')) { blocked = true; break } await new Promise(r => setTimeout(r, 20)) }
        assert(blocked, b.record.stderr || 'B SQL script must really wait on A'); a.child.stdin.end('confermato locale\n')
        assert.equal(await a.record.done, 0, a.record.stderr); assert.equal(await b.record.done, 0, b.record.stderr)
        assert(b.record.stdout.includes('GREEN_CONCURRENT_REVISION_REJECTED')); report.sql_files.push({ file: 'concorrenza-A.sql', pass: true }, { file: 'concorrenza-B.sql', pass: true })
      } finally { for (const child of children) if (child.exitCode === null) child.kill(); for (const record of records) fs.writeFileSync(path.join(artifact, record.file + '.log'), record.stdout + '\nSTDERR\n' + record.stderr) }
    })
    const rpcClient = { async rpc(name, args) { try { return { data: await rawCall(name, args), error: null } } catch (e) { return { data: null, error: { code: e.code, message: e.message } } } } }
    const archive = creaArchivioScadenziario(rpcClient)
    await check('actual adapter/UI controller persists across reload/session and logical archive', async () => {
      const uiId = crypto.randomUUID(), r = { id: uiId, tipo: 'INPS', periodo: 'UI fixture ' + uiId, dataScadenza: '2026-12-01', importoCentesimi: 10025, stato: 'Da verificare', nota: '', riferimento: '', includiNeiTotali: true }
      let m = controller(archive)
      for (let i = 0; i < 250 && !m.render().pronta; i++) { await m.flush(); if (m.render().errore) throw Error(m.render().errore); await new Promise(r => setTimeout(r, 20)) }
      assert(m.render().pronta, 'Initial UI read must complete')
      await m.render().onSalva(r, null); m.unmount()
      const reload = async () => { const next = controller(creaArchivioScadenziario(rpcClient)); for (let i = 0; i < 100; i++) { await next.flush(); if (next.render().pronta) return next; await new Promise(r => setTimeout(r, 20)) } throw Error('UI reload did not load') }
      m = await reload(); assert.equal(m.render().righe.find(x => x.id === uiId).importoCentesimi, 10025)
      await m.render().onSalva({ ...r, nota: 'persisted edit' }, uiId); m.unmount(); m = await reload(); assert.equal(m.render().righe.find(x => x.id === uiId).nota, 'persisted edit')
      await m.render().onArchivia(uiId, 'UI archive'); m.unmount(); m = await reload(); assert(!m.render().righe.some(x => x.id === uiId)); m.unmount()
      assert((await rawCall('leggi_scadenze_fiscali', { p_includi_archiviate: true })).righe.some(x => x.id === uiId && x.archiviata_at))
      const denied = creaArchivioScadenziario({ rpc: (name, args) => rawCall(name, args, 'authenticated', outsider) }); const failed = controller(denied)
      for (let i = 0; i < 20; i++) { await failed.flush(); if (failed.render().errore) break; await new Promise(r => setTimeout(r, 20)) }
      assert.equal(failed.render().pronta, false); assert(failed.render().errore); assert.equal(failed.render().righe.length, 0); failed.unmount()
      report.persistence_reload = { create: true, edit: true, archive: true, history: true, error_distinct_from_empty: true, memory_fallback: false }
    })
    await check('F24 excluded from all horizons, Pagato no lateral payment/cost/incasso writes', async () => {
      const f = await create(base({ tipo: 'F24', importo_previsto: '1000.00', includi_nei_totali: false })); const rows = (await archive.elenco()).filter(r => r.id === f.id)
      const kpi = riepilogaScadenze(rows, '2026-11-10'); for (const key of ['entro30', 'entro60', 'entro90']) assert.equal(kpi[key].centesimi, 0)
      await rawCall('aggiorna_scadenza_fiscale', { p_id: f.id, p_revisione_attesa: '0', p_dati: { ...f.d, stato: 'pagato' } })
      assert.deepEqual((await counts()).rows, lateralBefore)
      assert.equal((await db.query("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='artecna_contabilita.scadenze_fiscali'::regclass AND NOT tgisinternal")).rows[0].n, 0)
    })
    report.catalog = (await db.query("SELECT p.oid::regprocedure::text AS signature,p.proowner::regrole::text AS owner,p.prosecdef,p.proconfig,p.proacl::text FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN('leggi_scadenze_fiscali','crea_scadenza_fiscale','aggiorna_scadenza_fiscale','archivia_scadenza_fiscale') ORDER BY 1")).rows
    report.dependencies = (await db.query("SELECT pg_describe_object(classid,objid,objsubid) AS object,pg_describe_object(refclassid,refobjid,refobjsubid) AS referenced,deptype FROM pg_depend WHERE objid='artecna_contabilita.scadenze_fiscali'::regclass OR refobjid='artecna_contabilita.scadenze_fiscali'::regclass")).rows
    if (process.argv.includes('--browser')) await check('real browser reload against native local database', async () => {
      await db.query('DELETE FROM artecna_contabilita.scadenze_fiscali')
      const fixture = await require('./browser-fixture.cjs').startBrowserFixture({ root, artifact, rpc: (name, args) => rawCall(name, args, 'authenticated', name === 'leggi_scadenze_fiscali' && fs.existsSync(path.join(artifact, 'FORCE-READ-ERROR')) ? outsider : uid) })
      fs.writeFileSync(path.join(root, '.run/scadenziario/db-gate/BROWSER-HANDOFF.json'), JSON.stringify({ url: fixture.url, directory: artifact }, null, 2)); console.log('BROWSER_LOCAL_READY ' + fixture.url)
      try {
        const done = path.join(artifact, 'BROWSER-DONE.json'), until = Date.now() + 10 * 60 * 1000
        while (!fs.existsSync(done) && Date.now() < until) await new Promise(r => setTimeout(r, 200))
        assert(fs.existsSync(done), 'Browser smoke must finish explicitly')
        report.browser = JSON.parse(fs.readFileSync(done, 'utf8')); assert.equal(report.browser.pass, true)
        const stored = (await db.query("SELECT importo_previsto::text,note,archiviata_at IS NOT NULL AS archived,revisione::text FROM artecna_contabilita.scadenze_fiscali WHERE periodo_riferimento='UI-RELOAD-LOCAL'")).rows
        assert.equal(stored.length, 1); assert.equal(stored[0].importo_previsto, '101.25'); assert.equal(stored[0].archived, true); assert.equal(stored[0].revisione, '2')
        const history = await rawCall('leggi_scadenze_fiscali', { p_includi_archiviate: true }); assert.equal(history.righe.length, 1)
        assert.deepEqual((await counts()).rows, lateralBefore)
      } finally { await fixture.close() }
    })
    report.pass = true
  } catch (error) { report.pass = false; report.error = { message: error.message, code: error.code, detail: error.detail, where: error.where }; throw error }
  finally {
    await Promise.allSettled(connections.map(c => c.end()))
    if (started) { exec('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop'], { stdio: 'ignore' }); report.stopped = true }
    report.pass_count = report.checks.filter(x => x.pass).length; report.fail_count = report.checks.filter(x => !x.pass).length
    fs.writeFileSync(path.join(artifact, 'RESULT.json'), JSON.stringify(report, null, 2)); fs.writeFileSync(path.join(root, '.run/scadenziario/db-gate/LAST-RUN.json'), JSON.stringify(report, null, 2))
    console.log('LOCAL_GATE_RESULT ' + path.join(artifact, 'RESULT.json'))
  }
})
