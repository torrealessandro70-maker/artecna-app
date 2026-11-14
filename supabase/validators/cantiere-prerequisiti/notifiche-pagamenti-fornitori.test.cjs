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

test('Notifiche Pagamenti fornitori con PostgreSQL 17.6', { timeout: 180000 }, () => withNative(async (db, connect) => {
  const q = async (sql, args) => (await db.query(sql, args)).rows
  const value = async (sql, args) => (await q(sql, args))[0].v
  const admin = await connect('fixture_admin')
  for (const name of ['20261108000800_cantiere_hard_delete_finale.sql', '20261108000900_cantiere_hard_delete_runtime_v2.sql']) {
    await q(load(name))
  }
  await admin.query('ALTER ROLE postgres SUPERUSER')
  const fixture = await seedRuntime(db, 0)
  await q(load('20261108001000_cantiere_hard_delete_runtime_v3.sql'))
  await alignAccountingAcl(db)
  await admin.query('ALTER ROLE postgres NOSUPERUSER CREATEROLE CREATEDB REPLICATION BYPASSRLS')
  await q(load('20261109001100_cantiere_delete_contabilita_schema_usage.sql'))
  await value("INSERT INTO public.pagamenti_fornitori(fornitore_nome,data_scadenza) VALUES('Legacy','2026-01-01') RETURNING id v")
  await q(load('20261112000500_rapportini_stato_operativo.sql'))
  await q(fs.readFileSync(path.join(__dirname,'../scadenziario/documenti-storage-fixture.sql'),'utf8'))
  for(const migration of ['20261110000100_scadenziario_fiscale_persistenza.sql','20261111000100_documenti_fiscali_privati.sql','20261112000100_notifiche_in_app_scadenziario.sql']){
    await q(load(migration))
  }
  await q('UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()')
  await q(load('20261113000100_rapportini_attesi_hard_delete.sql'))
  const scheduler = load('20261112000200_notifiche_scheduler.sql')
  const wrapper = scheduler.match(/CREATE OR REPLACE FUNCTION artecna_notifiche\.esegui_generatore_runtime\(\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/)?.[0]
  assert.ok(wrapper)
  await q(wrapper)
  for (const migration of ['20261112000300_notifiche_agenda.sql','20261112000400_notifiche_sopralluoghi.sql',
    '20261113000200_notifiche_rapportini_attesi.sql','20261113000300_debiti_fornitori.sql']) await q(load(migration))
  const signature = () => value('SELECT artecna_distruzione.hard_delete_catalog() v')
  const prima = await signature()
  await q(fs.readFileSync(path.join(__dirname, '../../migrations/20261114000100_notifiche_pagamenti_fornitori.sql'), 'utf8'))
  assert.equal(await signature(),prima)
  const titolare=fixture.u, esterno=randomUUID()
  await q('INSERT INTO auth.users(id) VALUES($1)',[esterno])
  await q("INSERT INTO public.utenti_impresa(user_id,ruolo,attivo) VALUES($1,'titolare',true) ON CONFLICT(user_id) DO UPDATE SET attivo=true",[titolare])
  const client=await connect('fixture_admin')
  const as = async (user,sql,args=[],connection=client) => {
    await connection.query('BEGIN')
    try {
      await connection.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user])
      await connection.query('SET LOCAL ROLE authenticated')
      const result=(await connection.query(sql,args)).rows
      await connection.query('COMMIT')
      return result
    } catch (error) { await connection.query('ROLLBACK'); throw error }
  }
  const registra='SELECT public.registra_debito_fornitore($1,$2) v'
  // Calling a composite expression with .* can evaluate it once per field.
  const modifica='SELECT * FROM public.verifica_debito_fornitore($1,$2,$3,$4,$5,$6)'

  const id=(await as(titolare,registra,[null,'Fixture']))[0].v
  const today = await value("SELECT (now() AT TIME ZONE 'Europe/Rome')::date::text v")
  const saldi = () => value('SELECT to_jsonb(d) v FROM public.pagamenti_fornitori d WHERE id=$1',[id])
  const run = instant => value('SELECT artecna_notifiche.genera_pagamenti_fornitori($1) v',[instant])
  const avvisi = () => q(`SELECT n.id,n.tipo_avviso,e.id AS evento,e.resolved_at
    FROM artecna_notifiche.notifica n JOIN artecna_notifiche.evento_notificabile e ON e.id=n.evento_id
    WHERE e.record_id=$1 AND e.modulo='pagamenti_fornitori' ORDER BY n.scheduled_at`,[id])
  assert.equal(await run(new Date().toISOString()),0,'bozza e legacy esclusi')
  await q('UPDATE public.pagamenti_fornitori SET cantiere_id=$2 WHERE id=$1',[id,fixture.b])
  let [d] = await as(titolare,modifica,[id,0,today,100,20,false])
  const copy = await saldi()
  const tomorrowRome = await value("SELECT ((now() AT TIME ZONE 'Europe/Rome')::date+1)::text v")
  const yesterdayRome = await value("SELECT ((now() AT TIME ZONE 'Europe/Rome')::date-1)::text v")
  await as(titolare,'SELECT public.crea_scadenza_fiscale($1,$2)',[randomUUID(),{
    tipo:'IVA',periodo_riferimento:'Fixture',data_scadenza:today,importo_previsto:'100.00',
    stato:'da_pagare',importo_pagato:null,data_pagamento:null, note:'Fixture',riferimento_documento:'Fixture',includi_nei_totali:true
  }])
  await q("INSERT INTO public.agenda_attivita(id,user_id,titolo,data,ora_inizio,ora_fine,tipo) VALUES ($1,$2,'Fixture',$3,'11:00','12:00','Altro')",[randomUUID(),titolare,tomorrowRome])
  await q("INSERT INTO public.sopralluoghi(id,cliente,data_sopralluogo,ora_appuntamento,stato) VALUES ($1,'Fixture',$2,'11:00','da_preventivare')",[randomUUID(),tomorrowRome])
  await as(titolare,'SELECT public.configura_rapportini_attesi($1,0,false,NULL,7::smallint)',[fixture.a])
  await as(titolare,'SELECT public.pianifica_rapportini_attesi($1,1,$2)',[fixture.a,JSON.stringify([{giorno:yesterdayRome,ora:'10:00'}])])
  assert.ok(await value('SELECT artecna_notifiche.esegui_generatore_runtime() v') >= 5)
  const counts=(await as(titolare,'SELECT public.contatori_notifiche() v'))[0].v
  assert.deepEqual(counts,{totale:5,scadenziario:1,agenda:1,sopralluoghi:1,rapportini:1,pagamenti_fornitori:1})
  assert.equal(await value('SELECT artecna_notifiche.esegui_generatore_runtime() v'),0)
  assert.deepEqual(await saldi(),copy)
  const [first] = await avvisi()
  assert.equal(first.tipo_avviso,'oggi')
  const lookup='SELECT public.risolvi_destinazione_notifica($1) v'
  assert.deepEqual((await as(titolare,lookup,[first.id]))[0].v,{ azione:'apri_debito_fornitore',record_id:id })
  assert.equal((await as(esterno,lookup,[first.id]))[0].v,null)
  const count=async()=> (await as(titolare,'SELECT public.contatori_notifiche() v'))[0].v.pagamenti_fornitori
  assert.equal(await count(),1)
  let pendingRpc = Promise.resolve()
  const browserActor = (sql,args) => {
    const result = pendingRpc.then(async () => (await as(titolare,sql,args))[0]?.v)
    pendingRpc = result.catch(() => {})
    return result
  }
  await require('./browser/attesi-page-browser.cjs')(browserActor,fixture.a,{
    owner:titolare,draft:id,notification:first.id,entry:'notifiche-fornitori-entry.mjs',modes:['center','draft'],
    commands:{
      leggi_debiti_fornitori:["SELECT coalesce(jsonb_agg(d),'[]'::jsonb) v FROM public.leggi_debiti_fornitori($1,$2) d",'p_id','p_fattura'],
      leggi_preferenze_notifiche:['SELECT public.leggi_preferenze_notifiche() v']
    }
  })
  assert.deepEqual(await saldi(),copy)
  await q('UPDATE public.cantieri SET lavori_conclusi=true WHERE id=$1',[fixture.b])
  assert.equal(await run(new Date().toISOString()),0)
  assert.equal(await count(),1,'chiusura cantiere indipendente')
  await q('UPDATE public.cantieri SET lavori_conclusi=false WHERE id=$1',[fixture.b])
  await as(titolare,'SELECT public.configura_rapportini_attesi($1,0,true,NULL,7::smallint)',[fixture.b])
  assert.equal(await run(new Date().toISOString()),0)
  assert.equal(await count(),1,'sospensione Rapportini indipendente')
  assert.deepEqual(await saldi(),copy)
  ;[d] = await as(titolare,modifica,[id,d.revisione_debito,today,100,40,false])
  assert.equal(await run(new Date().toISOString()),0)
  assert.equal((await avvisi())[0].evento,first.evento)
  const tomorrow = await value("SELECT ((now() AT TIME ZONE 'Europe/Rome')::date+1)::text v")
  ;[d] = await as(titolare,modifica,[id,d.revisione_debito,tomorrow,100,40,false])
  assert.equal(await count(),0,'termine spostato: vecchio avviso invisibile prima del cron')
  await run(new Date().toISOString())
  const rows=await avvisi()
  assert.notEqual(rows.find(r=>!r.resolved_at).evento,first.evento)
  assert.equal(await count(),1)
  await q('UPDATE public.utenti_impresa SET attivo=false WHERE user_id=$1',[titolare])
  assert.equal((await as(titolare,lookup,[rows.find(r=>!r.resolved_at).id]))[0].v,null)
  assert.equal(await count(),0)
  await run(new Date().toISOString())
  await q('UPDATE public.utenti_impresa SET attivo=true WHERE user_id=$1',[titolare])
  await run(tomorrow+'T23:30:00Z')
  await run(tomorrow+'T23:50:00Z')
  assert.equal((await avvisi()).filter(r=>r.tipo_avviso==='scaduta').length,1)
  ;[d] = await as(titolare,modifica,[id,d.revisione_debito,tomorrow,100,100,false])
  assert.equal(await count(),0)
  await run(tomorrow+'T23:50:00Z')
  assert.ok((await avvisi()).every(r=>r.resolved_at))
  assert.equal(await value("SELECT artecna_notifiche.avviso_debito_fornitore('2026-10-26',('2026-10-25 23:30+00'::timestamptz AT TIME ZONE 'Europe/Rome')::date,ARRAY[7,3,0]) v"),'oggi')
  assert.equal(await value("SELECT artecna_notifiche.avviso_debito_fornitore('2026-10-26','2026-10-19',ARRAY[7,3,0]) v"),'7')
  const annullato=(await as(titolare,registra,[null,'Fixture da annullare']))[0].v
  const [aperto]=await as(titolare,modifica,[annullato,0,today,100,0,false])
  await run(new Date().toISOString())
  assert.equal(await count(),1)
  await as(titolare,modifica,[annullato,aperto.revisione_debito,null,null,null,true])
  assert.equal(await count(),0,'annullamento escluso prima del cron')
  await run(new Date().toISOString())
  assert.equal(await value("SELECT count(*)::int v FROM artecna_notifiche.evento_notificabile WHERE record_id=$1 AND resolved_at IS NOT NULL",[annullato]),1)
  const oldSave='SELECT public.salva_preferenze_notifiche($1,true,true,true,ARRAY[30,7,3,0],true,ARRAY[1,0],true,ARRAY[1,0],true) v'
  const newSave='SELECT public.salva_preferenze_notifiche($1,true,true,true,ARRAY[30,7,3,0],true,ARRAY[1,0],true,ARRAY[1,0],true,false,ARRAY[7]) v'
  const saved=(await as(titolare,newSave,[0]))[0].v
  const preserved=(await as(titolare,oldSave,[saved.revisione]))[0].v
  assert.equal(preserved.pagamenti_fornitori,false)
  assert.deepEqual(preserved.anticipi_pagamenti_fornitori,[7])
}, { productionActor: true, beforeMigrations: certifiedInstallerFixture }))
