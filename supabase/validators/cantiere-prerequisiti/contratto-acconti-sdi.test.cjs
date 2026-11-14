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

test('Contratto fiscale su PostgreSQL 17.6', { timeout: 180000 }, () => withNative(async (db, connect) => {
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

  await q(load('20261114000200_contratto_acconti_fatture_sdi.sql'))
  assert.equal(await signature(),prima)
  const a=await value("INSERT INTO public.acconti_cantiere(cantiere_id,importo,data_incasso) VALUES ($1,100,CURRENT_DATE) RETURNING id v",[fixture.a])
  const b=await value("INSERT INTO public.acconti_cantiere(cantiere_id,importo,data_incasso) VALUES ($1,50,CURRENT_DATE) RETURNING id v",[fixture.a])
  const doc=async(totale)=>value("INSERT INTO public.fatture_emesse(cantiere_id,cliente,totale,data_fattura) VALUES ($1,'Fixture', $2,CURRENT_DATE) RETURNING id v",[fixture.a,totale])
  const fattura=await doc(150), nota=await doc(-30)
  const today=await value("SELECT (now() AT TIME ZONE 'Europe/Rome')::date::text v")
  const stato=async id=>(await as(titolare,'SELECT public.leggi_acconto_fiscale($1) v',[id]))[0].v
  const incasso='SELECT public.registra_acconto_fiscale($1,$2,$3,$4,$5,$6)'
  assert.equal((await stato(a)).stato,'Da verificare')
  await as(titolare,incasso,[a,0,'previsto','da_verificare',null,'Fixture'])
  assert.equal((await stato(a)).stato,'Non ancora incassato')
  await assert.rejects(as(titolare,incasso,[a,1,'incassato','ordinario',null,'Fixture']),{code:'22023'})
  await as(titolare,incasso,[a,1,'incassato','ordinario',today,'Fixture'])
  await as(titolare,incasso,[b,0,'incassato','ordinario',today,'Fixture'])
  assert.equal((await stato(a)).giorni_residui,12)
  const sql='SELECT public.registra_evidenza_sdi($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)'
  const time=new Date(Date.now()-60000).toISOString()
  const sdi=(id,rev,tipo,esito,orig=null,quote=[])=>as(titolare,sql,[id,rev,tipo,esito,time,esito==='inviata'?null:time,null,'Fixture ricevuta',orig,JSON.stringify(quote)])
  await sdi(fattura,0,'TD02','inviata')
  const la=randomUUID(),lb=randomUUID()
  const link=(id,f,a,quota)=>as(titolare,'SELECT public.collega_incasso_cliente($1,$2,$3,$4,true)',[id,f,a,quota])
  await link(la,fattura,a,100)
  await link(lb,fattura,b,50)
  assert.match((await stato(a)).stato,/In attesa/)
  await sdi(fattura,1,'TD02','consegnata')
  assert.equal((await stato(a)).stato,'Regolarizzato')
  await sdi(nota,0,'TD04','mancata_consegna',fattura)
  assert.equal((await stato(b)).stato,'Da verificare')
  const quote=[{attribuzione_id:la,quota:20},{attribuzione_id:lb,quota:10}]
  await sdi(nota,1,'TD04','mancata_consegna',fattura,quote)
  assert.equal((await stato(a)).copertura,80)
  assert.equal((await stato(b)).copertura,40)
  await assert.rejects(sdi(nota,2,'TD04','consegnata',fattura,[{attribuzione_id:la,quota:40}]),{code:'23514'})
  await assert.rejects(link(randomUUID(),nota,b,1),{code:'22023'})
  const browser=require('./browser/attesi-page-browser.cjs')
  const actor=async (query,args)=>(await as(titolare,query,args))[0].v
  const browserContext={owner:titolare,entry:'contratto-sdi-entry.mjs',commands:{
    leggi_acconto_fiscale:['SELECT public.leggi_acconto_fiscale($1) v','p_id'],
    leggi_fattura_sdi:['SELECT public.leggi_fattura_sdi($1) v','p_id'],
  }}
  await browser(actor,fattura,{...browserContext,draft:nota,modes:['nota']})
  await sdi(nota,2,'TD04','scartata',fattura,quote)
  await browser(actor,fattura,{...browserContext,draft:a,modes:['acconto']})
  await sdi(fattura,2,'TD02','scartata')
  assert.equal((await stato(a)).copertura,0)
  await assert.rejects(as(esterno,'SELECT public.leggi_fattura_sdi($1)',[fattura]),{code:'42501'})
  await assert.rejects(as(titolare,'UPDATE artecna_contabilita.fatture_sdi SET esito=\'consegnata\''),{code:'42501'})
  await q('UPDATE public.utenti_impresa SET attivo=false WHERE user_id=$1',[titolare])
  await assert.rejects(stato(a),{code:'42501'})
}, { productionActor: true, noSync: true, beforeMigrations: certifiedInstallerFixture }))
