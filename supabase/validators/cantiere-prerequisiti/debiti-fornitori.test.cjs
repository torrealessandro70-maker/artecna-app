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

test('Debiti fornitori con PostgreSQL 17.6 e Hard Delete V3', { timeout: 180000 }, () => withNative(async (db, connect) => {
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
  const legacy = await value("INSERT INTO public.pagamenti_fornitori(fornitore_nome,data_scadenza) VALUES('Legacy','2026-01-01') RETURNING id v")
  await q(load('20261112000500_rapportini_stato_operativo.sql'))
  await q(fs.readFileSync(path.join(__dirname,'../scadenziario/documenti-storage-fixture.sql'),'utf8'))
  for(const migration of ['20261110000100_scadenziario_fiscale_persistenza.sql','20261111000100_documenti_fiscali_privati.sql','20261112000100_notifiche_in_app_scadenziario.sql']){
    await q(load(migration))
  }
  await q('UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()')
  await q(load('20261113000100_rapportini_attesi_hard_delete.sql'))
  const acl = () => q(`SELECT x.rolname, x.rolsuper, x.rolbypassrls,
    has_table_privilege(x.rolname,'public.pagamenti_fornitori','SELECT') AS lettura,
    has_table_privilege(x.rolname,'public.pagamenti_fornitori','INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER') AS scrittura,
    has_any_column_privilege(x.rolname,'public.pagamenti_fornitori','INSERT,UPDATE') AS scrittura_colonne,
    pg_has_role(x.rolname,'postgres','MEMBER') AS membro_owner
    FROM pg_roles x WHERE x.rolname IN ('anon','authenticated','service_role') ORDER BY 1`)
  const beforeAcl=await acl()
  assert.ok(beforeAcl.every(r=>r.lettura && r.scrittura && !r.rolsuper && !r.membro_owner))

  await q(load('20261113000300_debiti_fornitori.sql'))
  const scheduler = load('20261112000200_notifiche_scheduler.sql')
  const wrapper = scheduler.match(/CREATE OR REPLACE FUNCTION artecna_notifiche\.esegui_generatore_runtime\(\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/)?.[0]
  assert.ok(wrapper)
  await q(wrapper)
  for (const migration of ['20261112000300_notifiche_agenda.sql','20261112000400_notifiche_sopralluoghi.sql','20261113000200_notifiche_rapportini_attesi.sql','20261114000100_notifiche_pagamenti_fornitori.sql']) await q(load(migration))
  await q(fs.readFileSync(path.join(__dirname, '../../migrations/20261114000200_contratto_acconti_fatture_sdi.sql'), 'utf8'))
  console.log('Fixture migrations complete', Math.round(process.uptime()*1000), 'ms')
  const afterAcl=await acl()
  assert.ok(afterAcl.every(r=>r.lettura && !r.scrittura && !r.scrittura_colonne))
  console.log({beforeAcl,afterAcl})
  assert.equal(await value('SELECT signature=artecna_distruzione.hard_delete_catalog() v FROM artecna_distruzione.hard_delete_catalog_expected'), true)
  assert.equal(await value('SELECT verificato_at IS NULL AND origine_debito IS NULL v FROM public.pagamenti_fornitori WHERE id=$1',[legacy]), true)

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
  const fattura=await value("INSERT INTO public.fatture_fornitori(fornitore,numero_fattura,data_fattura,importo_totale) VALUES('Test','F1','2026-11-01',100) RETURNING id v")
  await assert.rejects(as(esterno,registra,[fattura,null]),{code:'42501'})
  assert.equal(await value('SELECT count(*)::int v FROM public.fatture_fornitori WHERE id=$1',[fattura]),1)
  assert.equal((await as(esterno,'SELECT id FROM public.pagamenti_fornitori')).length,0)
  await assert.rejects(as(esterno,'SELECT * FROM public.leggi_debiti_fornitori()'),{code:'42501'})
  assert.ok((await as(titolare,'SELECT id FROM public.pagamenti_fornitori')).some(d=>d.id===legacy))
  const id=(await as(titolare,registra,[fattura,null]))[0].v
  assert.equal((await as(titolare,registra,[fattura,null]))[0].v,id)
  const [debito]=await as(titolare,'SELECT * FROM public.leggi_debiti_fornitori(NULL,$1)',[fattura])
  assert.equal(debito.id,id)
  assert.equal(debito.data_scadenza,null)
  assert.equal(debito.importo_pagato,null)
  await assert.rejects(as(titolare,modifica,[legacy,0,'2026-11-01',100,0,false]),{code:'22023'})
  for (const [date,paid] of [[null,0],['2026-11-01',null],['2026-11-01',101]]) {
    await assert.rejects(as(titolare,modifica,[id,0,date,100,paid,false]),{code:'22023'})
  }
  let [r]=await as(titolare,modifica,[id,0,'2026-11-01',100,20,false])
  assert.equal(r.importo_pagato,'20')
  assert.equal(r.verificato_da,titolare)
  await assert.rejects(as(titolare,modifica,[id,0,'2026-11-01',100,100,false]),{code:'PT409'})
  await assert.rejects(as(titolare,'UPDATE public.pagamenti_fornitori SET importo_pagato=99 WHERE id=$1 RETURNING id',[id]),{code:'42501'})
  // Associate the synthetic document debt before performing the operational actions.
  await q('UPDATE public.pagamenti_fornitori SET cantiere_id=$2 WHERE id=$1',[id,fixture.b])
  const leggiAperto=async()=>(await as(titolare,
    'SELECT to_jsonb(d) v FROM public.leggi_debiti_fornitori($1) d WHERE importo_totale-importo_pagato=80 AND annullato_at IS NULL',
    [id]))[0].v
  const primaOperazioni=await leggiAperto()
  const nome=await value('SELECT nome v FROM public.cantieri WHERE id=$1',[fixture.b])
  const cambiaChiusura=async chiuso=>as(titolare,
    "SELECT public.rinomina_cantiere_legacy_senza_allegati($1,$2,$2,'registro',jsonb_build_object('preventivo',0,'data_inizio_lavori',NULL,'data_fine_lavori',NULL,'lavori_conclusi',$3::boolean))",
    [fixture.b,nome,chiuso])
  await cambiaChiusura(true)
  assert.equal(await value('SELECT lavori_conclusi v FROM public.cantieri WHERE id=$1',[fixture.b]),true)
  assert.deepEqual(await leggiAperto(),primaOperazioni)
  console.log('PASS chiusura cantiere e debito aperto invariato')
  await cambiaChiusura(false)
  assert.equal(await value('SELECT lavori_conclusi v FROM public.cantieri WHERE id=$1',[fixture.b]),false)
  await as(titolare,'SELECT public.configura_rapportini_attesi($1,0,true,NULL,7::smallint) v',[fixture.b])
  assert.equal(await value('SELECT sospeso v FROM artecna_rapportini.configurazione_attesi WHERE cantiere_id=$1',[fixture.b]),true)
  assert.deepEqual(await leggiAperto(),primaOperazioni)
  console.log('PASS sospensione Rapportini e debito aperto invariato')
  ;[r]=await as(titolare,modifica,[id,1,'2026-11-01',100,100,false])
  assert.equal(r.importo_pagato,r.importo_totale)
  ;[r]=await as(titolare,modifica,[id,2,null,null,null,true])
  assert.equal(r.annullato_da,titolare)
  await assert.rejects(q('DELETE FROM public.fatture_fornitori WHERE id=$1',[fattura]),{code:'23503'})
  assert.equal((await as(titolare,'SELECT * FROM public.leggi_debiti_fornitori($1)',[id]))[0].fattura_id,fattura)
  const manuale=(await as(titolare,registra,[null,'Manuale']))[0].v
  assert.equal((await as(titolare,'SELECT * FROM public.leggi_debiti_fornitori($1)',[manuale]))[0].origine_debito,'manuale')
  await assert.rejects(q('DELETE FROM public.pagamenti_fornitori WHERE id=$1',[manuale]),{code:'23503'})
  const concorrente=await connect('fixture_admin')
  const tentativi=await Promise.allSettled([
    as(titolare,modifica,[manuale,0,'2026-11-20',100,0,false]),
    as(titolare,modifica,[manuale,0,'2026-11-21',100,10,false],concorrente),
  ])
  assert.equal(tentativi.filter(t=>t.status==='fulfilled').length,1)
  assert.equal(tentativi.find(t=>t.status==='rejected').reason.code,'PT409')
  // Exercise the Hosted-style service role with BYPASSRLS on this temporary database.
  await admin.query('ALTER ROLE service_role BYPASSRLS')
  await admin.query('BEGIN')
  try {
    await admin.query('SET LOCAL ROLE service_role')
    assert.deepEqual((await admin.query(`SELECT current_user AS ruolo,r.rolsuper,r.rolbypassrls,
      pg_has_role(current_user,'postgres','MEMBER') AS membro_owner FROM pg_roles r WHERE r.rolname=current_user`)).rows[0],
      {ruolo:'service_role',rolsuper:false,rolbypassrls:true,membro_owner:false})
    const { rowCount } = await admin.query(
      'UPDATE public.pagamenti_fornitori SET importo_pagato=25 WHERE id=$1 AND verificato_at IS NOT NULL',
      [manuale],
    )
    assert.equal(rowCount,0,'Un writer diretto non deve cambiare il cumulativo lasciando invariata la conferma')
  } catch (error) {
    if (error.code !== '42501') throw error
  } finally {
    await admin.query('ROLLBACK')
    await admin.query('ALTER ROLE service_role NOBYPASSRLS')
  }
  const confermato=(await as(titolare,'SELECT * FROM public.leggi_debiti_fornitori($1)',[manuale]))[0]
  assert.equal(confermato.revisione_debito,'1')
  assert.ok(['0','10'].includes(confermato.importo_pagato))
  assert.ok(confermato.verificato_at)
  await q('UPDATE public.pagamenti_fornitori SET cantiere_id=$2 WHERE id=$1',[id,fixture.a])
  await assert.rejects(as(titolare,"SELECT * FROM public.elimina_cantiere_definitivamente($1,'ELIMINA')",[fixture.a]),{code:'23503'})
  assert.equal(await value('SELECT count(*)::int v FROM public.cantieri WHERE id=$1',[fixture.a]),1)
  assert.equal(await value('SELECT count(*)::int v FROM public.fatture_fornitori WHERE id=$1',[fattura]),1)
  await q('UPDATE public.pagamenti_fornitori SET cantiere_id=NULL WHERE id=$1',[id])
  const browser = require('./browser/attesi-page-browser.cjs')
  let pending = Promise.resolve()
  let forzaConflitto=true
  const browserActor=(sql,args)=>{
    const next=pending.then(async () => {
      if (forzaConflitto && sql.includes('verifica_debito_fornitore') && args[4]==='77') {
        forzaConflitto=false
        await as(titolare,modifica,[args[0],args[1],'2026-11-20',100,100,false],concorrente)
      }
      return (await as(titolare,sql,args))[0]?.v
    })
    pending=next.catch(()=>{})
    return next
  }
  const contestoBrowser={
    entry:'debiti-entry.cjs', owner:titolare, draft:fattura, day:id,
    modes:['manuale','cumulativo','elenco','fattura','conflitto'],
    commands:{
      leggi_debiti_fornitori:["SELECT coalesce(jsonb_agg(d),'[]'::jsonb) v FROM public.leggi_debiti_fornitori(NULL,$1) d",'p_fattura'],
      registra_debito_fornitore:[registra,'p_fattura','p_fornitore'],
      verifica_debito_fornitore:['SELECT to_jsonb(d) v FROM public.verifica_debito_fornitore($1,$2,$3,$4,$5,$6) d','p_id','p_revisione','p_scadenza','p_dovuto','p_pagato','p_annulla'],
    }
  }
  await browser(browserActor,fixture.b,contestoBrowser)
  // The versioned production-cleanup fixture documents this existing invoice policy.
  // The native baseline enables RLS here but does not replay its policies.
  await q('CREATE POLICY "Permetti tutto fatture fornitori" ON public.fatture_fornitori FOR ALL TO PUBLIC USING (true) WITH CHECK (true)')
  const fatturaRecupero=(await as(titolare,"INSERT INTO public.fatture_fornitori(fornitore,numero_fattura,data_fattura,importo_totale) VALUES('Test recupero','F2','2026-11-02',100) RETURNING id v"))[0].v
  await assert.rejects(as(esterno,registra,[fatturaRecupero,null]),{code:'42501'})
  const recupero={...contestoBrowser,draft:fatturaRecupero,modes:['recupero']}
  await browser(browserActor,fixture.b,recupero)
  assert.equal(await value('SELECT count(*)::int v FROM public.fatture_fornitori WHERE id=$1',[fatturaRecupero]),1)
  assert.equal(await value('SELECT count(*)::int v FROM public.pagamenti_fornitori WHERE fattura_id=$1 AND annullato_at IS NOT NULL',[fatturaRecupero]),1)
  assert.equal(await value("SELECT count(*)::int v FROM public.pagamenti_fornitori WHERE fornitore_nome='Fixture browser' AND origine_debito='manuale' AND revisione_debito=4 AND importo_pagato=100 AND importo_totale=100"),1)
  await q('CREATE POLICY "Fixture righe import" ON public.fatture_fornitori_righe FOR ALL TO authenticated USING (true) WITH CHECK (true)')
  let fallimentoIniettato=false
  let uuidRecuperato
  let scritturePrimaAperture
  const testata="SELECT coalesce(jsonb_agg(f),'[]'::jsonb) v FROM public.fatture_fornitori f"
  // The bridge reproduces the two PostgREST INSERT requests using the fixture JWT role.
  const inserisciTestata=`WITH inserted AS (
    INSERT INTO public.fatture_fornitori(fornitore,partita_iva,numero_fattura,data_fattura,tipo_documento,importo_totale,nome_file,tipo_file,xml_testo,pdf_testo,stato)
    SELECT fornitore,partita_iva,numero_fattura,data_fattura,tipo_documento,importo_totale,nome_file,tipo_file,xml_testo,pdf_testo,stato
    FROM jsonb_populate_record(NULL::public.fatture_fornitori,$1::jsonb) RETURNING *)
    SELECT to_jsonb(inserted) v FROM inserted`
  const inserisciRighe=`WITH inserted AS (
    INSERT INTO public.fatture_fornitori_righe(fattura_id,numero_riga,descrizione,quantita,prezzo_unitario,unita_misura,aliquota_iva,totale_riga,cantiere,stato)
    SELECT fattura_id,numero_riga,descrizione,quantita,prezzo_unitario,unita_misura,aliquota_iva,totale_riga,cantiere,stato
    FROM jsonb_populate_recordset(NULL::public.fatture_fornitori_righe,$1::jsonb) RETURNING id)
    SELECT count(*) v FROM inserted`
  await q('CREATE POLICY "Fixture materiali import" ON public.materiali_cantiere FOR INSERT TO authenticated WITH CHECK (true)')
  const inserisciMateriale=`INSERT INTO public.materiali_cantiere(cantiere,descrizione,quantita,prezzo_unitario,totale,fornitore,data_documento,nome_file,file_tipo,anteprima_testo)
    SELECT cantiere,descrizione,quantita,prezzo_unitario,totale,fornitore,data_documento,nome_file,file_tipo,anteprima_testo
    FROM jsonb_populate_record(NULL::public.materiali_cantiere,$1::jsonb)`
  const snapshotFattura=async()=>value(`SELECT coalesce(jsonb_agg(jsonb_build_array(to_jsonb(f),to_jsonb(d))),'[]'::jsonb) v
    FROM public.fatture_fornitori f LEFT JOIN public.pagamenti_fornitori d ON d.fattura_id=f.id WHERE f.numero_fattura='E2E-UNICA'`)
  const actorPagina=async(sql,args)=>{
    if(sql===registra&&!fallimentoIniettato){
      fallimentoIniettato=true
      const [[f,d]]=await snapshotFattura()
      assert.equal(f.id,args[0])
      assert.equal(d,null)
      return (await as(esterno,sql,args))[0]?.v
    }
    return browserActor(sql,args)
  }
  await browser(actorPagina,fixture.b,{
    ...contestoBrowser,entry:'debiti-pagina-entry.cjs',modes:['parziale','pagina-registro','pagina-pagamenti'],
    read:{fatture_fornitori:testata},
    commands:{...contestoBrowser.commands,fixture_insert_fatture_fornitori:[inserisciTestata,'data'],
      fixture_insert_fatture_fornitori_righe:[inserisciRighe,'data'],fixture_insert_materiali_cantiere:[inserisciMateriale,'data']},
    async onPass(mode,uuid){
      const snapshot=await snapshotFattura()
      assert.equal(snapshot.length,1)
      assert.equal(snapshot[0][1].id,uuid)
      if(mode==='parziale'){uuidRecuperato=uuid;scritturePrimaAperture=snapshot}
      else {assert.equal(uuid,uuidRecuperato);assert.deepEqual(snapshot,scritturePrimaAperture)}
    },
  })
  assert.ok(fallimentoIniettato)
  await q('DELETE FROM public.pagamenti_fornitori WHERE id=$1',[legacy])
  const original = await value('SELECT to_jsonb(d) v FROM public.pagamenti_fornitori d WHERE id=$1',[id])
  await q('INSERT INTO public.pagamenti_fornitori(cantiere_id,fornitore_nome) VALUES($1,$2)',[fixture.a,'Legacy del cantiere'])
  assert.equal((await as(titolare,"SELECT * FROM public.elimina_cantiere_definitivamente($1,'ELIMINA')",[fixture.a]))[0].eliminato,true)
  assert.equal(await value('SELECT count(*)::int v FROM public.pagamenti_fornitori WHERE cantiere_id=$1',[fixture.a]),0)
  assert.deepEqual(await value('SELECT to_jsonb(d) v FROM public.pagamenti_fornitori d WHERE id=$1',[id]),original)
  assert.equal(await value('SELECT count(*)::int v FROM public.fatture_fornitori WHERE id=$1',[fattura]),1)
}, { productionActor: true, noSync: true, timing: true, beforeMigrations: certifiedInstallerFixture }))
