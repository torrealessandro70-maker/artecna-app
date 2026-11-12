/* eslint-disable @typescript-eslint/no-require-imports -- Native PostgreSQL fixture, loopback only. */
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const { execFileSync } = require('node:child_process')
const { Client } = require('pg')

const root = path.resolve(__dirname, '../../..')
const binaries = path.resolve(root, '../cantiere-hard-delete-runtime/.run/cantiere-prereq-runtime/minimal/pgsql/bin')
const migrationPath = path.join(root, 'supabase/migrations/20261112000100_notifiche_in_app_scadenziario.sql')
const migration = fs.readFileSync(migrationPath, 'utf8')
const uid = '00000000-0000-4000-8000-000000000001'
const secondo = '00000000-0000-4000-8000-000000000002'
const esterno = '00000000-0000-4000-8000-000000000003'
const sqlVersion = async client => (await client.query('SHOW server_version')).rows[0].server_version

test('SQL statico: transazione unica, RLS, privilegi espliciti, nessun scheduler', () => {
  assert.match(migration, /^BEGIN;/)
  assert.match(migration, /COMMIT;\s*$/)
  assert.equal([...migration.matchAll(/^COMMIT;/gm)].length, 1)
  assert.equal([...migration.matchAll(/ENABLE ROW LEVEL SECURITY/g)].length, 3)
  assert.doesNotMatch(migration, /cron\.schedule|CREATE EXTENSION|GRANT .* TO anon/i)
  assert.match(migration, /UNIQUE \(evento_id, recipient_user_id, tipo_avviso, scheduled_at\)/)
  for (const [, definition] of migration.matchAll(/CREATE FUNCTION public\.([\s\S]*?)AS \$\$/g)) {
    assert.match(definition, /SECURITY DEFINER SET search_path = pg_catalog, pg_temp/)
  }
})

test('PostgreSQL 17.6: Scadenziario, Agenda e Sopralluoghi, dedup, isolamento, risoluzione e DST', { timeout: 120_000 }, async () => {
  const base = path.join(root, '.run/notifiche')
  fs.mkdirSync(base, { recursive: true })
  const fixture = fs.mkdtempSync(path.join(base, 'cluster-'))
  const data = path.join(fixture, 'data')
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)))
  const pg = (program, args, options = {}) => execFileSync(path.join(binaries, program + '.exe'), args,
    { env, encoding: 'utf8', windowsHide: true, timeout: 45_000, ...options })
  assert.equal(pg('postgres', ['--version']).trim(), 'postgres (PostgreSQL) 17.6')
  const listener = net.createServer()
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve))
  const { port } = listener.address()
  await new Promise(resolve => listener.close(resolve))
  const clients = []
  let started = false
  const connect = async (user = 'fixture_admin') => {
    const client = new Client({ host: '127.0.0.1', port, user, database: 'postgres', ssl: false, password: 'fixture', connectionTimeoutMillis: 5_000 })
    await client.connect()
    clients.push(client)
    return client
  }
  try {
    pg('initdb', ['-D', data, '-U', 'fixture_admin', '-A', 'trust', '--no-sync', '--no-locale', '-E', 'UTF8'])
    pg('pg_ctl', ['-D', data, '-l', path.join(fixture, 'server.log'), '-o', '-h 127.0.0.1 -p ' + port, '-w', 'start'], { stdio: 'ignore' })
    started = true
    const admin = await connect()
    await admin.query('CREATE ROLE postgres LOGIN SUPERUSER; ALTER DATABASE postgres OWNER TO postgres')
    const a = await connect('postgres')
    await a.query(fs.readFileSync(path.join(root, 'supabase/validators/cantiere-prerequisiti/baseline.sql'), 'utf8'))
    await a.query(fs.readFileSync(path.join(__dirname, 'documenti-storage-fixture.sql'), 'utf8'))
    await a.query('SET check_function_bodies=on')
    await a.query(fs.readFileSync(path.join(root, 'supabase/migrations/20261110000100_scadenziario_fiscale_persistenza.sql'), 'utf8'))
    await admin.query('ALTER ROLE postgres NOSUPERUSER CREATEROLE CREATEDB REPLICATION BYPASSRLS')
    await a.query(fs.readFileSync(path.join(root, 'supabase/migrations/20261111000100_documenti_fiscali_privati.sql'), 'utf8'))
    await a.query(migration)
    assert.equal(await sqlVersion(a), '17.6')
    const b = await connect('postgres')
    const sql = async (client, query, params) => (await client.query(query, params)).rows[0]?.result
    const actor = async (id, query, params, role = 'authenticated') => {
      await admin.query('BEGIN')
      try {
        await admin.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [id])
        await admin.query(role === 'anon' ? 'SET LOCAL ROLE anon' : 'SET LOCAL ROLE authenticated')
        return await sql(admin, query, params)
      } finally { await admin.query('ROLLBACK') }
    }
    const writeAs = async (id, query, params) => {
      await admin.query('BEGIN')
      try {
        await admin.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [id])
        await admin.query('SET LOCAL ROLE authenticated')
        const result = await sql(admin, query, params)
        await admin.query('COMMIT')
        return result
      } catch (error) { await admin.query('ROLLBACK'); throw error }
    }
    const genera = (client, ora) => sql(client, 'SELECT artecna_notifiche.genera_scadenze($1) result', [ora])
    const id = randomUUID()
    await a.query('INSERT INTO auth.users(id) VALUES ($1),($2),($3)', [uid, secondo, esterno])
    await a.query("INSERT INTO public.utenti_impresa(user_id,ruolo,attivo) VALUES ($1,'titolare',true),($2,'titolare',true)", [uid, secondo])
    const payload = { tipo: 'IVA', periodo_riferimento: 'Fixture', data_scadenza: '2026-03-29',
      importo_previsto: '100.00', stato: 'da_pagare', importo_pagato: null, data_pagamento: null,
      note: 'Nota privata', riferimento_documento: 'Documento privato', includi_nei_totali: true }
    await writeAs(uid, 'SELECT public.crea_scadenza_fiscale($1,$2) result', [id, payload])
    assert.equal(await genera(a, '2026-02-26T22:59:59Z'), 0)
    const pids = await Promise.all([a, b].map(client => sql(client, 'SELECT pg_backend_pid() result')))
    assert.notEqual(pids[0], pids[1])
    await a.query('BEGIN')
    assert.equal(await genera(a, '2026-02-26T23:00:00Z'), 2)
    const concorrente = genera(b, '2026-02-26T23:00:00Z')
    try {
      let waiting = false
      for (let i = 0; i < 50 && !waiting; i++) {
        waiting = await sql(admin, "SELECT wait_event = 'advisory' result FROM pg_stat_activity WHERE pid=$1", [pids[1]])
        if (!waiting) await new Promise(resolve => setTimeout(resolve, 20))
      }
      assert.equal(waiting, true)
    } finally { await a.query('COMMIT'); assert.equal(await concorrente, 0) }
    for (const ora of ['2026-03-21T23:00:00Z','2026-03-25T23:00:00Z','2026-03-28T23:00:00Z','2026-03-29T22:00:00Z']) {
      assert.equal(await genera(a, ora), 2)
    }
    assert.equal(await genera(a, '2026-03-31T22:00:00Z'), 0)
    const avvisi = (await a.query('SELECT tipo_avviso, scheduled_at FROM artecna_notifiche.notifica WHERE recipient_user_id=$1 ORDER BY scheduled_at', [uid])).rows
    assert.deepEqual(avvisi.map(row => row.tipo_avviso), ['30','7','3','oggi','scaduta'])
    assert.equal(avvisi[3].scheduled_at.toISOString(), '2026-03-28T23:00:00.000Z')
    assert.equal(avvisi[4].scheduled_at.toISOString(), '2026-03-29T22:00:00.000Z')
    const counter = 'SELECT public.contatori_notifiche() result'
    const list = "SELECT public.lista_notifiche('tutte') result"
    const resolve = 'SELECT public.risolvi_destinazione_notifica($1) result'
    const leggiPreferenze = 'SELECT public.leggi_preferenze_notifiche() result'
    assert.deepEqual(await actor(uid, leggiPreferenze), { generali: true, in_app: true, scadenziario: true, anticipi: [30,7,3,0], revisione: 0 })
    const source = () => sql(a, 'SELECT to_jsonb(s) result FROM artecna_contabilita.scadenze_fiscali s WHERE id=$1', [id])
    const originale = await source()
    const rows = await actor(uid, list)
    assert.equal(rows.length, 5)
    assert.doesNotMatch(JSON.stringify(rows), /Nota privata|Documento privato|record_id/)
    assert.deepEqual(await actor(uid, counter), { totale: 1, scadenziario: 1 })
    assert.deepEqual(await actor(uid, resolve, [rows[0].id]), { azione: 'apri_scadenza_fiscale', record_id: id })
    assert.equal(await actor(secondo, resolve, [rows[0].id]), null)
    assert.equal(await actor(secondo, "SELECT public.aggiorna_stato_notifica($1,'leggi') result", [rows[0].id]), false)
    await assert.rejects(actor(esterno, counter), { code: '42501' })
    await assert.rejects(actor(uid, list, [], 'anon'), { code: '42501' })
    await assert.rejects(actor(uid, 'SELECT * FROM artecna_notifiche.notifica'), { code: '42501' })
    await assert.rejects(actor(uid, 'SELECT artecna_notifiche.genera_scadenze()'), { code: '42501' })
    assert.equal(rows.filter(row => row.attiva).length, 1)
    await writeAs(uid, "SELECT public.aggiorna_stato_notifica($1,'leggi') result", [rows[0].id])
    assert.deepEqual(await actor(uid, counter), { totale: 0, scadenziario: 0 })
    assert.deepEqual(await actor(secondo, counter), { totale: 1, scadenziario: 1 })
    assert.equal(await writeAs(uid, "SELECT public.aggiorna_stato_notifica($1,'archivia') result", [rows[0].id]), true)
    assert.equal((await actor(uid, list)).length, 4)
    assert.equal(await actor(uid, resolve, [rows[0].id]), null)
    assert.deepEqual(await source(), originale)
    const prefs = 'SELECT public.salva_preferenze_notifiche(0,true,true,true,ARRAY[0]) result'
    await writeAs(secondo, prefs)
    await assert.rejects(writeAs(secondo, prefs), { code: '40001' })
    assert.deepEqual(await actor(secondo, leggiPreferenze), { generali: true, in_app: true, scadenziario: true, anticipi: [0], revisione: 1 })
    const aggiorna = (rev, patch) => writeAs(uid, 'SELECT public.aggiorna_scadenza_fiscale($1,$2,$3) result',
      [id, rev, { ...payload, ...patch }])
    await aggiorna(0, { note: 'altra nota', importo_previsto: '200.00' })
    assert.equal(await genera(a, '2026-04-01T00:00:00Z'), 0)
    assert.equal(await sql(a, 'SELECT count(*)::int result FROM artecna_notifiche.evento_notificabile'), 1)
    await aggiorna(1, { data_scadenza: '2026-04-08' })
    assert.deepEqual(await actor(secondo, counter), { totale: 0, scadenziario: 0 })
    assert.equal(await genera(a, '2026-04-01T00:00:00Z'), 1)
    await aggiorna(2, { data_scadenza: '2026-04-08', stato: 'pagato' })
    assert.deepEqual(await actor(uid, counter), { totale: 0, scadenziario: 0 })
    assert.equal(await genera(a, '2026-04-09T00:00:00Z'), 0)
    await aggiorna(3, { data_scadenza: '2026-04-08' })
    assert.equal(await genera(a, '2026-04-09T00:00:00Z'), 2)
    const attive = await actor(uid, "SELECT public.lista_notifiche('urgenti') result")
    assert.equal(attive.length, 1)
    await writeAs(uid, 'SELECT public.archivia_scadenza_fiscale($1,4,$2) result', [id, 'fixture'])
    assert.deepEqual(await actor(uid, counter), { totale: 0, scadenziario: 0 })
    assert.equal(await actor(uid, resolve, [attive[0].id]), null)
    assert.equal(await genera(a, '2026-04-10T00:00:00Z'), 0)
    await a.query('UPDATE public.utenti_impresa SET attivo=false WHERE user_id=$1', [uid])
    await assert.rejects(actor(uid, counter), { code: '42501' })
    // Use the versioned Agenda schema and wrapper, without installing pg_cron or committing the new migration.
    const agendaSchema = fs.readFileSync(path.join(root, 'supabase/migrations/20260618_agenda_attivita.sql'), 'utf8')
    if (!(await sql(a, "SELECT to_regclass('public.agenda_attivita') IS NOT NULL result"))) await a.query(agendaSchema)
    const scheduler = fs.readFileSync(path.join(root, 'supabase/migrations/20261112000200_notifiche_scheduler.sql'), 'utf8')
    const wrapper = scheduler.match(/CREATE OR REPLACE FUNCTION artecna_notifiche\.esegui_generatore_runtime\(\)[\s\S]*?\$runtime\$;/)?.[0]
    assert.ok(wrapper)
    await a.query(wrapper)
    await admin.query('GRANT authenticated TO postgres')
    const agendaMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20261112000300_notifiche_agenda.sql'), 'utf8')
    assert.doesNotMatch(agendaMigration, /cron\.|CREATE TRIGGER|ALTER TABLE public\.agenda_attivita/)
    await a.query('BEGIN')
    try {
      await a.query(agendaMigration.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, ''))
      const validator = fs.readFileSync(path.join(__dirname, 'notifiche-agenda-readonly.sql'), 'utf8')
      await a.query(validator.replace(/^BEGIN READ ONLY;\s*/, '').replace(/ROLLBACK;\s*$/, ''))
      const agendaId = randomUUID()
      const insert = "INSERT INTO public.agenda_attivita(id,user_id,titolo,descrizione,data,ora_inizio,ora_fine,tipo) VALUES ($1,$2,'Titolo privato','Nota privata',$3,$4,$5,'Altro')"
      await a.query(insert, [agendaId, esterno, '2026-03-29', '02:30', '03:00'])
      const run = ora => sql(a, 'SELECT artecna_notifiche.genera_agenda($1) result', [ora])
      const active = () => sql(a, "SELECT to_jsonb(v) result FROM artecna_notifiche.visibili($1) v WHERE attiva", [esterno])
      assert.equal(await run('2026-03-27T22:59:59Z'), 0)
      assert.equal(await run('2026-03-27T23:00:00Z'), 1)
      assert.equal(await run('2026-03-27T23:00:00Z'), 0)
      assert.equal((await active()).messaggio, 'Impegno domani.')
      assert.equal(await run('2026-03-28T23:00:00Z'), 1)
      assert.equal((await active()).messaggio, 'Impegno oggi.')
      const evento = () => sql(a, "SELECT to_jsonb(e) result FROM artecna_notifiche.evento_notificabile e WHERE record_id=$1 AND resolved_at IS NULL", [agendaId])
      const before = await evento()
      assert.equal(new Date(before.data_evento).toISOString(), '2026-03-29T01:30:00.000Z')
      await a.query("UPDATE public.agenda_attivita SET titolo='Nuovo titolo', descrizione='Nuova nota' WHERE id=$1", [agendaId])
      assert.equal(await run('2026-03-29T01:29:59Z'), 0)
      assert.equal((await evento()).id, before.id)
      assert.equal(await run('2026-03-29T01:30:00Z'), 1)
      assert.equal((await active()).priorita, 'urgente')
      const as = async (user, query, params) => {
        await a.query('SAVEPOINT jwt_fixture')
        try {
          await a.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [user])
          await a.query('SET LOCAL ROLE authenticated')
          return await sql(a, query, params)
        } finally { await a.query('ROLLBACK TO jwt_fixture; RELEASE jwt_fixture') }
      }
      const notifica = await active()
      assert.deepEqual(await as(esterno, counter), { totale: 1, scadenziario: 0, agenda: 1 })
      assert.deepEqual(await as(esterno, resolve, [notifica.id]), { azione: 'apri_attivita_agenda', record_id: agendaId })
      assert.equal(await as(secondo, resolve, [notifica.id]), null)
      assert.doesNotMatch(JSON.stringify(await as(esterno, list)), /Nuovo titolo|Nuova nota/)
      await assert.rejects(as(esterno, 'SELECT artecna_notifiche.genera_agenda(now())'), { code: '42501' })
      assert.deepEqual((await as(esterno, leggiPreferenze)).anticipi_agenda, [1,0])
      const preferenzeAgenda = 'SELECT public.salva_preferenze_notifiche(0,true,true,true,ARRAY[0],false,ARRAY[1]) result'
      assert.equal((await as(esterno, preferenzeAgenda)).agenda, false)
      assert.equal((await as(esterno, list))[0].data_evento, before.data_evento)
      await a.query("UPDATE public.agenda_attivita SET ora_inizio='03:20', ora_fine='04:00' WHERE id=$1", [agendaId])
      assert.equal(await active(), undefined)
      assert.equal(await run('2026-03-29T01:35:00Z'), 1)
      assert.notEqual((await evento()).id, before.id)
      await a.query("UPDATE public.agenda_attivita SET data='2026-10-25', ora_inizio='02:30', ora_fine='03:00' WHERE id=$1", [agendaId])
      assert.equal(await run('2026-10-24T22:00:00Z'), 1)
      assert.equal(new Date((await evento()).data_evento).toISOString(), '2026-10-25T01:30:00.000Z')
      await a.query("UPDATE public.agenda_attivita SET stato='completata' WHERE id=$1", [agendaId])
      assert.equal(await active(), undefined)
      assert.equal(await run('2026-10-25T03:00:00Z'), 0)
      assert.equal(await evento(), undefined)

      const runtimeAgenda = randomUUID()
      const runtimeFisco = randomUUID()
      const ieri = await sql(a, "SELECT ((now() AT TIME ZONE 'Europe/Rome')::date - 1)::text result")
      await a.query(insert, [runtimeAgenda, secondo, ieri, '10:00', '11:00'])
      await a.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [secondo])
      await sql(a, "SELECT public.crea_scadenza_fiscale($1, $2) result", [runtimeFisco, { ...payload, data_scadenza: ieri }])
      const beforeSource = await sql(a, 'SELECT to_jsonb(s) result FROM artecna_contabilita.scadenze_fiscali s WHERE id=$1', [runtimeFisco])
      assert.equal(await sql(a, 'SELECT artecna_notifiche.esegui_generatore_runtime() result'), 2)
      assert.equal(await sql(a, 'SELECT artecna_notifiche.esegui_generatore_runtime() result'), 0)
      assert.deepEqual(await as(secondo, counter), { totale: 2, scadenziario: 1, agenda: 1 })
      assert.deepEqual(await sql(a, 'SELECT to_jsonb(s) result FROM artecna_contabilita.scadenze_fiscali s WHERE id=$1', [runtimeFisco]), beforeSource)

      const terzo = fs.readFileSync(path.join(root, 'supabase/migrations/20261112000400_notifiche_sopralluoghi.sql'), 'utf8')
      assert.match(terzo, /^BEGIN;/)
      assert.equal([...terzo.matchAll(/^COMMIT;/gm)].length, 1)
      assert.doesNotMatch(terzo, /cron\.|CREATE TRIGGER|ALTER TABLE public\.sopralluoghi/i)
      await a.query(terzo.replace(/^BEGIN;\s*/, '').replace(/COMMIT;\s*$/, ''))
      const validatorTerzo = fs.readFileSync(path.join(__dirname, 'notifiche-sopralluoghi-readonly.sql'), 'utf8')
      await a.query(validatorTerzo.replace(/^BEGIN READ ONLY;\s*/, '').replace(/ROLLBACK;\s*$/, ''))

      const sopralluogo = randomUUID()
      const passato = randomUUID()
      const ambiguo = randomUUID()
      const oggi = await sql(a, "SELECT (now() AT TIME ZONE 'Europe/Rome')::date::text result")
      const domani = await sql(a, "SELECT ((now() AT TIME ZONE 'Europe/Rome')::date + 1)::text result")
      const batchOggi = await sql(a, "SELECT ((now() AT TIME ZONE 'Europe/Rome')::date::timestamp AT TIME ZONE 'Europe/Rome') result")
      const batchDomani = await sql(a, "SELECT (((now() AT TIME ZONE 'Europe/Rome')::date + 1)::timestamp AT TIME ZONE 'Europe/Rome') result")
      const insertSopralluogo = "INSERT INTO public.sopralluoghi(id,cliente,note,data_sopralluogo,ora_appuntamento,stato) VALUES ($1,'Cliente fixture','Nota privata',$2,$3,'da_preventivare')"
      await a.query(insertSopralluogo, [sopralluogo, domani, '11:30'])
      await a.query(insertSopralluogo, [passato, ieri, '11:30'])
      await a.query(insertSopralluogo, [ambiguo, oggi, ''])
      const snapshot = () => sql(a, 'SELECT to_jsonb(s) result FROM public.sopralluoghi s WHERE id=$1', [sopralluogo])
      const prima = await snapshot()
      const reconcile = ora => sql(a, 'SELECT artecna_notifiche.genera_sopralluoghi($1) result', [ora])
      const eventoSopralluogo = () => sql(a, "SELECT id result FROM artecna_notifiche.evento_notificabile WHERE record_id=$1 AND modulo='sopralluoghi' AND resolved_at IS NULL", [sopralluogo])
      const countsPrima = await as(secondo, counter)
      assert.deepEqual(countsPrima, { totale: 2, scadenziario: 1, agenda: 1, sopralluoghi: 0 })
      assert.equal(await reconcile(batchOggi), 1)
      assert.equal(await reconcile(batchOggi), 0)
      assert.deepEqual(await snapshot(), prima)
      const originale = await eventoSopralluogo()
      const avvisi = async () => (await as(secondo, list)).filter(riga => riga.modulo === 'sopralluoghi')
      const [avviso] = await avvisi()
      assert.equal(avviso.messaggio, 'Appuntamento domani.')
      assert.equal(avviso.priorita, 'normale')
      assert.doesNotMatch(JSON.stringify(avviso), /Cliente fixture|Nota privata|foto|record_id/)
      assert.deepEqual(await as(secondo, resolve, [avviso.id]), { azione: 'apri_sopralluogo', record_id: sopralluogo })
      assert.equal(await as(esterno, resolve, [avviso.id]), null)
      assert.equal(await as(uid, resolve, [avviso.id]), null)
      assert.deepEqual(await as(secondo, counter), { totale: 3, scadenziario: 1, agenda: 1, sopralluoghi: 1 })
      await a.query("UPDATE public.sopralluoghi SET note='Cambiata', cliente='Altro titolo' WHERE id=$1", [sopralluogo])
      assert.equal(await reconcile(batchOggi), 0)
      assert.equal(await eventoSopralluogo(), originale)
      assert.equal(await reconcile(batchDomani), 1)
      assert.equal((await avvisi()).filter(riga => riga.attiva).length, 1)
      assert.equal((await avvisi()).find(riga => riga.attiva).messaggio, 'Appuntamento oggi.')
      assert.equal((await as(secondo, counter)).sopralluoghi, 1)
      await a.query("UPDATE public.sopralluoghi SET ora_appuntamento='12:30' WHERE id=$1", [sopralluogo])
      assert.equal((await as(secondo, counter)).sopralluoghi, 0)
      assert.equal(await reconcile(batchDomani), 1)
      assert.notEqual(await eventoSopralluogo(), originale)
      const secondoEvento = await eventoSopralluogo()
      await a.query("UPDATE public.sopralluoghi SET data_sopralluogo=data_sopralluogo+1 WHERE id=$1", [sopralluogo])
      assert.equal(await reconcile(batchDomani), 1)
      assert.notEqual(await eventoSopralluogo(), secondoEvento)
      for (const stato of ['preventivo_creato', 'archiviato']) {
        await a.query('UPDATE public.sopralluoghi SET stato=$2 WHERE id=$1', [sopralluogo, stato])
        assert.equal((await as(secondo, counter)).sopralluoghi, 0)
        assert.equal(await reconcile(batchDomani), 0)
        assert.equal(await eventoSopralluogo(), undefined)
        await a.query("UPDATE public.sopralluoghi SET stato='da_preventivare' WHERE id=$1", [sopralluogo])
        assert.equal(await reconcile(batchDomani), 1)
      }
      assert.equal(await sql(a, "SELECT artecna_notifiche.sopralluogo_orario('2026-03-29','02:30') result"), null)
      assert.equal(new Date(await sql(a, "SELECT (artecna_notifiche.sopralluogo_orario('2026-10-25','02:30') AT TIME ZONE 'Europe/Rome') result")).toISOString(), '2026-10-25T01:30:00.000Z')
      assert.equal(await sql(a, "SELECT count(*)::int result FROM artecna_notifiche.evento_notificabile WHERE record_id IN ($1,$2)", [passato, ambiguo]), 0)
      const precedenti = await as(secondo, leggiPreferenze)
      assert.equal(precedenti.sopralluoghi, true)
      const salvaTre = 'SELECT public.salva_preferenze_notifiche($1,true,true,true,ARRAY[0],true,ARRAY[1,0],false,ARRAY[1]) result'
      const salvate = await as(secondo, salvaTre, [precedenti.revisione])
      assert.equal(salvate.sopralluoghi, false)
      assert.deepEqual(salvate.anticipi_sopralluoghi, [1])
      assert.equal(salvate.revisione, precedenti.revisione + 1)
      await a.query('UPDATE artecna_notifiche.preferenze_notifiche SET sopralluoghi=false WHERE user_id=$1', [secondo])
      assert.equal((await as(secondo, counter)).sopralluoghi, 0)
      await a.query('DELETE FROM artecna_notifiche.preferenze_notifiche WHERE user_id=$1', [secondo])

      await a.query("UPDATE public.sopralluoghi SET data_sopralluogo=$2,ora_appuntamento='19:30' WHERE id=$1", [sopralluogo, domani])
      await a.query('DELETE FROM artecna_notifiche.notifica WHERE evento_id IN (SELECT id FROM artecna_notifiche.evento_notificabile WHERE record_id IN ($1,$2))', [runtimeFisco, runtimeAgenda])
      await a.query('DELETE FROM artecna_notifiche.evento_notificabile WHERE record_id IN ($1,$2)', [runtimeFisco, runtimeAgenda])
      assert.equal(await sql(a, 'SELECT artecna_notifiche.esegui_generatore_runtime() result'), 3)
      assert.equal(await sql(a, 'SELECT artecna_notifiche.esegui_generatore_runtime() result'), 0)
      assert.deepEqual(await as(secondo, counter), { totale: 3, scadenziario: 1, agenda: 1, sopralluoghi: 1 })
      const runtimeAvviso = (await avvisi()).find(riga => riga.attiva)
      await a.query('ALTER TABLE public.sopralluoghi ENABLE ROW LEVEL SECURITY')
      assert.equal(await as(secondo, resolve, [runtimeAvviso.id]), null)
      await a.query('ALTER TABLE public.sopralluoghi DISABLE ROW LEVEL SECURITY')
      assert.ok(await as(secondo, resolve, [runtimeAvviso.id]))
      await a.query('UPDATE public.utenti_impresa SET attivo=false WHERE user_id=$1', [secondo])
      assert.equal(await as(secondo, resolve, [runtimeAvviso.id]), null)
      assert.equal((await avvisi()).length, 0)
    } finally { await a.query('ROLLBACK') }

  } finally {
    await Promise.allSettled(clients.map(client => client.end()))
    if (started) pg('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'])
  }
})
