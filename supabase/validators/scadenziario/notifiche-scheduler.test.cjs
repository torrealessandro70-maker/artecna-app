/* eslint-disable @typescript-eslint/no-require-imports -- PostgreSQL loopback fixture. */
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createHash, randomUUID } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const { execFileSync } = require('node:child_process')
const { Client } = require('pg')

const root = path.resolve(__dirname, '../../..')
const binaries = path.resolve(root, '../cantiere-hard-delete-runtime/.run/cantiere-prereq-runtime/minimal/pgsql/bin')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const scheduler = read('supabase/migrations/20261112000200_notifiche_scheduler.sql')
const validator = read('supabase/validators/scadenziario/notifiche-scheduler-readonly.sql')
const job = 'artecna-notifiche-reconcile'
const runtime = 'postgres'
const command = 'SELECT artecna_notifiche.esegui_generatore_runtime();'

test('Contratto statico: comando unico, accesso ristretto e validator in sola lettura', () => {
  assert.equal([...scheduler.matchAll(/PERFORM cron\.schedule\(/g)].length, 1)
  assert.match(scheduler, /SECURITY DEFINER\s+SET search_path = pg_catalog, pg_temp/)
  assert.match(scheduler, /SELECT artecna_notifiche\.genera_scadenze\(pg_catalog\.now\(\)\)/)
  assert.doesNotMatch(scheduler, /CREATE EXTENSION|CREATE ROLE|\bLOGIN\b|PASSWORD|GRANT|SET LOCAL ROLE|cron\.schedule_in_database|cron\.alter_job/i)
  assert.match(validator, /^BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;/)
  assert.match(validator, /ROLLBACK;\s*$/)
  assert.doesNotMatch(validator, /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b|cron\.schedule\(/i)
  const original = read('supabase/migrations/20261112000100_notifiche_in_app_scadenziario.sql').replaceAll('\r\n', '\n')
  const body = original.split('CREATE FUNCTION artecna_notifiche.genera_scadenze(')[1].split('$$')[1]
  assert.ok(validator.includes(createHash('md5').update(body).digest('hex')))
  assert.doesNotMatch(body, /\bEXECUTE\b|\bDELETE FROM\b|\bUPDATE\s+\w+\./i)
  assert.deepEqual([...body.matchAll(/\bINSERT INTO\s+([\w.]+)/g)].map(match => match[1]),
    ['artecna_notifiche.evento_notificabile', 'artecna_notifiche.notifica'])
  for (const sql of [scheduler, validator]) {
    assert.ok(sql.includes(job))
    assert.ok(sql.includes('10 * * * *'))
    assert.ok(sql.includes(command))
  }
})

test('PostgreSQL 17.6: ruolo runtime, registrazione come postgres emulata e validator', { timeout: 120_000 }, async () => {
  const work = path.join(root, '.run/notifiche')
  fs.mkdirSync(work, { recursive: true })
  const fixture = fs.mkdtempSync(path.join(work, 'scheduler-cluster-'))
  const data = path.join(fixture, 'data')
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)))
  const pg = (program, args, options = {}) => execFileSync(path.join(binaries, program + '.exe'), args,
    { env, encoding: 'utf8', windowsHide: true, timeout: 45_000, ...options })
  assert.equal(pg('postgres', ['--version']).trim(), 'postgres (PostgreSQL) 17.6')
  const listener = net.createServer()
  await new Promise((resolve, reject) => listener.once('error', reject).listen(0, '127.0.0.1', resolve))
  const { port } = listener.address()
  await new Promise(resolve => listener.close(resolve))
  const clients = []
  const connect = async user => {
    const client = new Client({ host: '127.0.0.1', port, user, database: 'postgres', ssl: false, connectionTimeoutMillis: 5_000 })
    await client.connect()
    clients.push(client)
    return client
  }
  let started = false
  try {
    pg('initdb', ['-D', data, '-U', 'fixture_admin', '-A', 'trust', '--no-sync', '--no-locale', '-E', 'UTF8'])
    pg('pg_ctl', ['-D', data, '-l', path.join(fixture, 'server.log'), '-o', '-h 127.0.0.1 -p ' + port, '-w', 'start'], { stdio: 'ignore' })
    started = true
    const admin = await connect('fixture_admin')
    await admin.query(
      'CREATE ROLE postgres LOGIN CREATEROLE BYPASSRLS; ALTER DATABASE postgres OWNER TO postgres;' +
      'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;' +
      'CREATE SCHEMA cron; REVOKE ALL ON SCHEMA cron FROM PUBLIC;' +
      'CREATE TABLE cron.job (jobid bigint GENERATED ALWAYS AS IDENTITY, jobname text, schedule text,' +
      ' command text, database text, username text, active boolean, UNIQUE(jobname, username));' +
      'CREATE TABLE cron.job_run_details (runid bigint, jobid bigint, start_time timestamptz,' +
      ' end_time timestamptz, status text, return_message text);' +
      'ALTER TABLE cron.job ENABLE ROW LEVEL SECURITY;' +
      'CREATE POLICY proprie ON cron.job USING (username = current_user);' +
      'GRANT USAGE ON SCHEMA cron TO postgres WITH GRANT OPTION;' +
      'GRANT SELECT ON cron.job, cron.job_run_details TO postgres;'
    )
    // Emulates only pg_cron's catalog write and capture of the effective role. No daemon or jobs run.
    await admin.query(
      "CREATE FUNCTION cron.schedule(nome text, frequenza text, comando text) RETURNS bigint " +
      "LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$ " +
      "INSERT INTO cron.job(jobname,schedule,command,database,username,active) " +
      "VALUES (nome,frequenza,comando,current_database(),coalesce(nullif(current_setting('role'),'none'),session_user::text),true) " +
      "ON CONFLICT (jobname,username) DO UPDATE SET schedule=excluded.schedule,command=excluded.command " +
      "RETURNING jobid $$; GRANT EXECUTE ON FUNCTION cron.schedule(text,text,text) TO postgres WITH GRANT OPTION;"
    )
    const installer = await connect('postgres')
    await installer.query(
      'CREATE SCHEMA auth; CREATE SCHEMA artecna_contabilita; CREATE SCHEMA artecna_guardie;' +
      'CREATE TABLE auth.users(id uuid PRIMARY KEY); CREATE TABLE public.utenti_impresa(user_id uuid);' +
      'CREATE TABLE artecna_contabilita.scadenze_fiscali(id uuid PRIMARY KEY, stato text, data_scadenza date,' +
      ' archiviata_at timestamptz, revisione bigint);' +
      'CREATE TABLE artecna_contabilita.documenti_fiscali(id uuid); CREATE TABLE public.pagamenti(id uuid);' +
      'CREATE FUNCTION artecna_guardie.utente_puo_operare_impresa(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;' +
      'CREATE FUNCTION artecna_contabilita.scadenza_autorizza() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;'
    )
    await installer.query(read('supabase/migrations/20261112000100_notifiche_in_app_scadenziario.sql'))
    await installer.query("SET cron.database_name = 'postgres'")
    await assert.rejects(installer.query(scheduler), /Prerequisiti scheduler mancanti/)
    await installer.query('ROLLBACK')
    // Replace only the extension-presence predicate, already exercised above.
    const extensionCheck = "NOT EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron')"
    assert.equal(scheduler.split(extensionCheck).length, 2)
    const localScheduler = scheduler.replace(extensionCheck, 'FALSE')
    await installer.query(localScheduler)
    await installer.query(localScheduler)
    const { rows } = await installer.query('SELECT jobid,jobname,schedule,command,database,username,active FROM cron.job')
    assert.deepEqual(rows, [{ jobid: '1', jobname: job, schedule: '10 * * * *', command, database: 'postgres', username: runtime, active: true }])
    const report = results => results.find(result => result.command === 'SELECT').rows[0]
    assert.equal(report(await installer.query(validator)).stato_ultima_esecuzione, 'never_run')
    await admin.query("INSERT INTO cron.job_run_details VALUES (1, 1, now(), now() + interval '2 seconds', 'succeeded', 'SELECT 1')")
    assert.equal(report(await installer.query(validator)).stato_ultima_esecuzione, 'succeeded')
    await admin.query("INSERT INTO cron.job_run_details VALUES (2, 1, now(), now() + interval '3 seconds', 'failed', 'fixture')")
    const failed = report(await installer.query(validator))
    assert.equal(failed.stato_ultima_esecuzione, 'failed')
    assert.equal(failed.durata.seconds, 3)

    const user = randomUUID()
    const deadline = randomUUID()
    await installer.query('INSERT INTO auth.users VALUES ($1)', [user])
    await installer.query('INSERT INTO public.utenti_impresa VALUES ($1)', [user])
    await installer.query("INSERT INTO artecna_contabilita.scadenze_fiscali VALUES ($1, 'previsto', (now() AT TIME ZONE 'Europe/Rome')::date - 2, NULL, 7)", [deadline])
    const source = 'SELECT * FROM artecna_contabilita.scadenze_fiscali'
    const before = (await installer.query(source)).rows
    const worker = await connect(runtime)
    assert.deepEqual((await worker.query('SELECT session_user, current_user')).rows, [{ session_user: runtime, current_user: runtime }])
    assert.equal((await worker.query(command)).rows[0].esegui_generatore_runtime, 1)
    assert.equal((await worker.query(command)).rows[0].esegui_generatore_runtime, 0)
    const notices = await installer.query('SELECT tipo_avviso FROM artecna_notifiche.notifica')
    assert.deepEqual(notices.rows, [{ tipo_avviso: 'scaduta' }])
    assert.deepEqual((await installer.query(source)).rows, before)

    await installer.query('CREATE OR REPLACE FUNCTION artecna_notifiche.esegui_generatore_runtime() RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$ SELECT 0 $$')
    await assert.rejects(installer.query(validator), /corpo del wrapper divergenti/)
    await installer.query('ROLLBACK')
    await installer.query(localScheduler)

    for (const role of ['PUBLIC', 'anon', 'authenticated', 'service_role']) {
      await installer.query('GRANT EXECUTE ON FUNCTION artecna_notifiche.genera_scadenze(timestamptz) TO ' + role)
      await assert.rejects(installer.query(validator), /Funzione scheduler esposta al client/)
      await installer.query('ROLLBACK')
      await installer.query('REVOKE EXECUTE ON FUNCTION artecna_notifiche.genera_scadenze(timestamptz) FROM ' + role)
    }
    await installer.query('CREATE FUNCTION public.genera_scadenze_test() RETURNS integer LANGUAGE sql AS $$ SELECT 0 $$')
    await assert.rejects(installer.query(validator), /Funzione scheduler esposta al client/)
    await installer.query('ROLLBACK')
    await installer.query('DROP FUNCTION public.genera_scadenze_test()')

    await admin.query("UPDATE cron.job SET command = 'SELECT 1;'")
    await assert.rejects(installer.query(validator), /assente, duplicato o divergente/)
    await installer.query('ROLLBACK')
    await admin.query('UPDATE cron.job SET command = $1', [command])

    await admin.query("UPDATE cron.job SET schedule = '0 * * * *'")
    await assert.rejects(installer.query(localScheduler), /duplicato o configurazione divergente/)
    await installer.query('ROLLBACK')
    await assert.rejects(installer.query(validator), /assente, duplicato o divergente/)
    await installer.query('ROLLBACK')
    await admin.query("UPDATE cron.job SET schedule = '10 * * * *'")
    await admin.query("INSERT INTO cron.job(jobname, username) VALUES ($1, 'fixture_admin')", [job])
    await assert.rejects(installer.query(localScheduler), /duplicato o configurazione divergente/)
    await installer.query('ROLLBACK')
    await assert.rejects(installer.query(validator), /assente, duplicato o divergente/)
    await installer.query('ROLLBACK')
    assert.equal((await installer.query('SELECT count(*)::int FROM cron.job')).rows[0].count, 2)
  } finally {
    await Promise.allSettled(clients.map(client => client.end()))
    if (started) pg('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
  }
})
