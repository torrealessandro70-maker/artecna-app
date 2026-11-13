const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')

const filename = path.join(__dirname, 'rapportini-stato-operativo.test.cjs')
const source = fs.readFileSync(filename, 'utf8')
const anchor = "}, { productionActor: true"
const extension = String.raw`
  await t.test('Hard Delete con obblighi realmente installati', async () => {
    await q(fs.readFileSync(path.join(__dirname,'../scadenziario/documenti-storage-fixture.sql'),'utf8'))
    for (const name of ['20261110000100_scadenziario_fiscale_persistenza.sql',
      '20261111000100_documenti_fiscali_privati.sql','20261112000100_notifiche_in_app_scadenziario.sql']) {
      await q(load(name))
    }
    // Establish the synthetic baseline, whose signature differs from Production.
    await q('UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()')
    const candidate = load('20261113000100_rapportini_attesi_hard_delete.sql')
    const changed = candidate.replace('revisione > 0','revisione >= 0')
    assert.notEqual(candidate,changed)
    await assert.rejects(q(changed),{code:'P2113',message:'Delta catalogo Rapportini attesi inatteso'})
    await q('ROLLBACK')
    for (const [mutated,message] of [
      [candidate.replace('DEFAULT 7 CHECK','DEFAULT 15 CHECK'),'Default Rapportini attesi divergenti'],
      [candidate.replace('CREATE TEMP TABLE attesi_catalogo_dopo','ALTER INDEX artecna_rapportini.attesi_pkey SET (fillfactor=80); CREATE TEMP TABLE attesi_catalogo_dopo'),'Indici Rapportini attesi divergenti']
    ]) {
      assert.notEqual(mutated,candidate)
      await assert.rejects(q(mutated),{code:'P2113',message})
      await q('ROLLBACK')
    }
    const reference = JSON.parse(fs.readFileSync(path.join(__dirname,'rapportini-attesi-hard-delete-reference.json'),'utf8'))
    const observerBaseline = await connect('fixture_admin')
    await q('SET search_path=pg_catalog,pg_temp')
    const snapshotBaseline = async () => (await observerBaseline.query(
      "SELECT jsonb_build_object('firma',(SELECT signature FROM artecna_distruzione.hard_delete_catalog_expected),'catalogo',artecna_distruzione.hard_delete_catalog(),'cantieri',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.cantieri c),'rapportini',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.rapportini r),'schema',to_regclass('artecna_rapportini.attesi')) v"
    )).rows[0].v
    const beforeAttempts = await snapshotBaseline()
    for (const fn of reference.functions) {
      assert.equal((await q('SELECT pg_get_functiondef($1::regprocedure) v',[fn.identity]))[0].v,fn.definition)
      const ownerRole=fn.identity.startsWith('public.') ? 'artecna_cantieri_delete_rpc' : null
      for (const [attribute,command] of [
        ['procost','ALTER FUNCTION '+fn.identity+' COST 101'],
        ['proparallel','ALTER FUNCTION '+fn.identity+' PARALLEL SAFE'],
        ['prosrc MD5',fn.definition.replace('AS $function$','AS $function$ /* fixture drift */')]
      ]) {
        await q('BEGIN')
        try {
          if(ownerRole) {
            await q('GRANT artecna_cantieri_delete_rpc TO postgres WITH ADMIN FALSE, INHERIT FALSE, SET TRUE GRANTED BY postgres')
            await q('GRANT CREATE ON SCHEMA public TO artecna_cantieri_delete_rpc')
            await q('SET LOCAL ROLE artecna_cantieri_delete_rpc')
          }
          await q(command)
          if(ownerRole) await q('RESET ROLE')
          await assert.rejects(q(candidate),err=>err.code==='P2113' && err.message.includes(fn.identity+': '+attribute+','))
        } finally { await q('ROLLBACK') }
        assert.deepEqual(await snapshotBaseline(),beforeAttempts)
        assert.equal((await q('SELECT pg_get_functiondef($1::regprocedure) v',[fn.identity]))[0].v,fn.definition)
      }
    }
    await q(load('20261113000100_rapportini_attesi_hard_delete.sql'))
    const scheduler=load('20261112000200_notifiche_scheduler.sql')
    const wrapper=scheduler.match(/CREATE OR REPLACE FUNCTION artecna_notifiche\.esegui_generatore_runtime\(\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/)?.[0]
    assert.ok(wrapper)
    await q(wrapper)
    for(const name of ['20261112000300_notifiche_agenda.sql','20261112000400_notifiche_sopralluoghi.sql']) await q(load(name))
    await q(load('20261113000200_notifiche_rapportini_attesi.sql'))
    assert.equal((await signature()).actual,(await signature()).expected)
    let browserQueue = Promise.resolve()
    const browserActor = (sql,args,write) => {
      const next = browserQueue.then(()=>as(owner,sql,args,write))
      browserQueue = next.catch(()=>{})
      return next
    }
    await require('./browser/attesi-db-browser.cjs')(browserActor,cantiere)
    const browserObserver=await connect('fixture_admin')
    const persisted=(await browserObserver.query("SELECT id,giorno_lavoro::text,termine_at FROM artecna_rapportini.attesi WHERE cantiere_id=$1",[cantiere])).rows
    assert.equal(persisted.length,1)
    assert.equal(persisted[0].giorno_lavoro,'2026-12-04')
    assert.equal(persisted[0].termine_at.toISOString(),'2026-12-04T16:00:00.000Z')
    assert.match(persisted[0].id,/^[0-9a-f-]{36}$/)
    assert.deepEqual((await browserObserver.query('SELECT sospeso,sospeso_fino_al,revisione::int FROM artecna_rapportini.configurazione_attesi WHERE cantiere_id=$1',[cantiere])).rows,[{sospeso:false,sospeso_fino_al:null,revisione:2}])
    await q('DELETE FROM artecna_rapportini.attesi WHERE cantiere_id=$1',[cantiere])
    await q('DELETE FROM artecna_rapportini.configurazione_attesi WHERE cantiere_id=$1',[cantiere])
    await as(owner,'SELECT public.configura_rapportini_attesi($1,0,false,NULL,7::smallint) v',[cantiere],true)
    const giorni=JSON.stringify([{giorno:'2026-12-03',ora:'17:00'}])
    await as(owner,'SELECT public.pianifica_rapportini_attesi($1,1,$2) v',[cantiere,giorni],true)
    const manifest=(await q('SELECT artecna_distruzione.hard_delete_targets($1) v',[cantiere]))[0].v
    assert.equal(manifest['artecna_rapportini.attesi'].length,1)
    await as(owner,'SELECT public.configura_rapportini_attesi($1,0,false,NULL,15::smallint) v',[f.b],true)
    await as(owner,'SELECT public.pianifica_rapportini_attesi($1,1,$2) v',[f.b,giorni],true)
    const secondManifest=(await q('SELECT artecna_distruzione.hard_delete_targets($1) v',[f.b]))[0].v
    const secondObligation=secondManifest['artecna_rapportini.attesi'][0].id
    const obligation = manifest['artecna_rapportini.attesi'][0].id
    const eventSql = "INSERT INTO artecna_notifiche.evento_notificabile(modulo,tipo_record,record_id,tipo_evento,data_evento,revisione_sorgente,ambito) VALUES ($1,$2,$3,'test',now(),1,'impresa') RETURNING id"

    const other = (await q(eventSql,['agenda','rapportino_atteso',obligation]))[0].id
    assert.equal((await q("SELECT artecna_notifiche.genera_rapportini_attesi('2026-12-03 18:00+01') v"))[0].v,2)
    assert.equal((await q("SELECT artecna_notifiche.genera_rapportini_attesi('2026-12-03 19:00+01') v"))[0].v,0)
    const second = (await q("SELECT id FROM artecna_notifiche.evento_notificabile WHERE modulo='rapportini' AND record_id=$1",[secondObligation]))[0].id
    const target = (await q("SELECT id FROM artecna_notifiche.evento_notificabile WHERE modulo='rapportini' AND record_id=$1",[obligation]))[0].id
    await as(owner,'SELECT public.configura_rapportini_attesi($1,1,true,NULL,7::smallint) v',[cantiere],true)
    assert.equal((await q("SELECT artecna_notifiche.genera_rapportini_attesi('2026-12-03 20:00+01') v"))[0].v,0)
    assert.ok((await q('SELECT resolved_at FROM artecna_notifiche.notifica WHERE evento_id=$1',[target]))[0].resolved_at)
    for (const id of [other]) {
      await q("INSERT INTO artecna_notifiche.notifica(evento_id,recipient_user_id,titolo,messaggio,priorita,tipo_avviso,scheduled_at,published_at,azione) VALUES ($1,$2,'Fixture','Fixture','normale','scaduta',now(),now(),'apri_scadenza_fiscale')",[id,owner])
    }
    const remove = "SELECT to_jsonb(x) v FROM public.elimina_cantiere_definitivamente($1,'ELIMINA') x"
    await assert.rejects(as(esterno,remove,[cantiere],true), {code:'42501'})
    await q('ALTER TABLE artecna_rapportini.attesi ADD COLUMN deriva_fixture text')
    await assert.rejects(as(owner,remove,[cantiere],true), {code:'P2113'})
    await q('ALTER TABLE artecna_rapportini.attesi DROP COLUMN deriva_fixture')
    const allRows = async client => {
      const tables = (await client.query("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('public','artecna_rapportini','artecna_notifiche','artecna_contabilita','artecna_distruzione') ORDER BY 1,2")).rows
      const out = {}
      for (const {schemaname,tablename} of tables) {
        const identifier = [schemaname,tablename].map(part=>'"'+part.replaceAll('"','""')+'"').join('.')
        out[identifier]=(await client.query("SELECT to_jsonb(t) v FROM "+identifier+' t ORDER BY to_jsonb(t)::text COLLATE "C"')).rows
      }
      return out
    }
    const rollbackBefore=await allRows(admin)
    // A notification DELETE is complete by the time the parent event is deleted.
    // The test trigger is outside the signed inventory and verifies that fact.
    await q("CREATE FUNCTION artecna_rapportini.fixture_fail_attesi_event() RETURNS trigger LANGUAGE plpgsql AS $fixture$BEGIN IF EXISTS(SELECT FROM artecna_notifiche.notifica WHERE evento_id=OLD.id) THEN RAISE EXCEPTION USING ERRCODE='ZX002'; END IF; RAISE EXCEPTION USING ERRCODE='ZX001',MESSAGE='fixture: notification already deleted'; END;$fixture$")
    await q("CREATE TRIGGER fixture_fail_attesi BEFORE DELETE ON artecna_notifiche.evento_notificabile FOR EACH ROW WHEN (OLD.modulo='rapportini') EXECUTE FUNCTION artecna_rapportini.fixture_fail_attesi_event()")
    try {
      await assert.rejects(as(owner,remove,[cantiere],true),{code:'ZX001',message:'fixture: notification already deleted'})
      const observer=await connect('fixture_admin')
      assert.deepEqual(await allRows(observer),rollbackBefore)
      assert.deepEqual((await observer.query('SELECT evento_id AS id FROM artecna_notifiche.notifica ORDER BY 1')).rows,
        [target,other,second].sort().map(id=>({id})))
      assert.deepEqual((await observer.query('SELECT artecna_distruzione.hard_delete_targets($1) v',[f.b])).rows[0].v['artecna_rapportini.attesi'],
        secondManifest['artecna_rapportini.attesi'])
    } finally {
      await q('DROP TRIGGER fixture_fail_attesi ON artecna_notifiche.evento_notificabile; DROP FUNCTION artecna_rapportini.fixture_fail_attesi_event()')
    }
    await actor(a,owner)
    try {
      assert.equal((await a.query(remove,[cantiere])).rows[0].v.eliminato,true)
      await a.query('RESET ROLE')
      for (const table of ['evento_notificabile','notifica']) {
        const key = table==='notifica' ? 'evento_id' : 'id'
        assert.deepEqual((await a.query('SELECT '+key+' AS id FROM artecna_notifiche.'+table+' ORDER BY 1')).rows,[other,second].sort().map(id=>({id})))
      }
      assert.equal((await a.query('SELECT count(*)::int n FROM artecna_rapportini.attesi WHERE cantiere_id=$1',[cantiere])).rows[0].n,0)
      assert.equal((await a.query('SELECT count(*)::int n FROM artecna_rapportini.configurazione_attesi WHERE cantiere_id=$1',[cantiere])).rows[0].n,0)
    } finally { await a.query('ROLLBACK') }
    assert.equal((await q('SELECT count(*)::int n FROM artecna_notifiche.evento_notificabile'))[0].n,3)
    const observer = await connect('fixture_admin')
    const snapshot = async () => (await observer.query(
      "SELECT jsonb_build_array((SELECT to_jsonb(c) FROM artecna_rapportini.configurazione_attesi c WHERE c.cantiere_id=$1),(SELECT to_jsonb(a) FROM artecna_rapportini.attesi a WHERE a.id=$2),(SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM artecna_notifiche.evento_notificabile e WHERE e.id=ANY($3::uuid[])),(SELECT jsonb_agg(to_jsonb(n) ORDER BY n.id) FROM artecna_notifiche.notifica n WHERE n.evento_id=ANY($3::uuid[]))) v",
      [f.b,secondObligation,[other,second]]
    )).rows[0].v
    { // RPC Centro: badge, preferenze e deep link con accesso corrente
      const today=(await q("SELECT (now() AT TIME ZONE 'Europe/Rome')::date::text v"))[0].v
      const prior=(await q("SELECT ((now() AT TIME ZONE 'Europe/Rome')::date-1)::text v"))[0].v
      await as(owner,'SELECT public.pianifica_rapportini_attesi($1,1,$2) v',
        [f.b,JSON.stringify([{giorno:prior,ora:'00:00'}])],true)
      await q('SELECT artecna_notifiche.esegui_generatore_runtime()')
      const n=(await q("SELECT n.id FROM artecna_notifiche.notifica n JOIN artecna_notifiche.evento_notificabile e ON e.id=n.evento_id JOIN artecna_rapportini.attesi a ON a.id=e.record_id WHERE a.cantiere_id=$1 AND a.giorno_lavoro=$2",[f.b,prior]))[0].id
      const counters='SELECT public.contatori_notifiche() v'
      const resolve='SELECT public.risolvi_destinazione_notifica($1) v'
      assert.equal((await as(owner,counters,[])).rapportini,1)
      assert.deepEqual(await as(owner,resolve,[n]),{
        azione:'apri_rapportino_atteso',record_id:(await q('SELECT id FROM artecna_rapportini.attesi WHERE cantiere_id=$1 AND giorno_lavoro=$2',[f.b,prior]))[0].id,
        cantiere_id:f.b,giorno_lavoro:prior,bozza_id:null
      })
      assert.equal(await as(esterno,resolve,[n]),null)
      const pageFixture = require('./browser/attesi-page-browser.cjs')
      const fixtures = {
        owner, notification:n, modes:['badge'],
        cantieri:await q('SELECT * FROM public.cantieri WHERE id=$1',[f.b]),
        rapportini:await q('SELECT * FROM public.rapportini WHERE cantiere_id=$1',[f.b])
      }
      const badgeAgenda=randomUUID()
      const badgeTomorrow=(await q("SELECT ((now() AT TIME ZONE 'Europe/Rome')::date+1)::text v"))[0].v
      await q("INSERT INTO public.agenda_attivita(id,user_id,titolo,data,ora_inizio,ora_fine,tipo) VALUES ($1,$2,'Fixture badge',$3,'11:00','12:00','Altro')",[badgeAgenda,owner,badgeTomorrow])
      await q('SELECT artecna_notifiche.esegui_generatore_runtime()')
      const readBadgeAgenda=async()=>await q("SELECT to_jsonb(n) v FROM artecna_notifiche.notifica n JOIN artecna_notifiche.evento_notificabile e ON e.id=n.evento_id WHERE e.record_id=$1 ORDER BY n.id",[badgeAgenda])
      const badgeAgendaBefore=await readBadgeAgenda()
      assert.ok(badgeAgendaBefore.length)
      await pageFixture(browserActor,f.b,fixtures)
      assert.deepEqual(await readBadgeAgenda(),badgeAgendaBefore)
      await q('DELETE FROM artecna_notifiche.notifica WHERE evento_id IN (SELECT id FROM artecna_notifiche.evento_notificabile WHERE record_id=$1)',[badgeAgenda])
      await q('DELETE FROM artecna_notifiche.evento_notificabile WHERE record_id=$1',[badgeAgenda])
      await q('DELETE FROM public.agenda_attivita WHERE id=$1',[badgeAgenda])
      const makeDraft = async () => (await q("INSERT INTO public.rapportini(cantiere_id,data) VALUES($1,$2) RETURNING *",[f.b,prior]))[0]
      const draft = await makeDraft()
      fixtures.draft=draft.id
      fixtures.day=prior
      fixtures.rapportini.push({...draft,data:prior})
      const readReports=async()=>await q('SELECT to_jsonb(r) v FROM public.rapportini r WHERE cantiere_id=$1 ORDER BY id',[f.b])
      let reportsBefore=await readReports()
      fixtures.modes=['center','draft']
      await pageFixture(browserActor,f.b,fixtures)
      assert.deepEqual(await readReports(),reportsBefore)
      fixtures.rapportini.push({...await makeDraft(),data:prior})
      reportsBefore=await readReports()
      fixtures.modes=['center-multiple','multiple']
      await pageFixture(browserActor,f.b,fixtures)
      assert.deepEqual(await readReports(),reportsBefore)
      await q('DELETE FROM public.rapportini WHERE id=ANY($1::uuid[])',[fixtures.rapportini.map(r=>r.id)])
      await as(owner,'SELECT public.configura_rapportini_attesi($1,3,true,$2,15::smallint) v',[f.b,today],true)
      assert.equal((await as(owner,counters,[])).rapportini,0)
      await as(owner,'SELECT public.configura_rapportini_attesi($1,4,false,NULL,15::smallint) v',[f.b],true)
      assert.equal((await as(owner,counters,[])).rapportini,1)
      await as(owner,"SELECT public.salva_preferenze_notifiche(0,true,true,true,ARRAY[30,7,3,0],true,ARRAY[1,0],true,ARRAY[1,0],false) v",[],true)
      assert.equal((await as(owner,counters,[])).rapportini,0)
      await as(owner,"SELECT public.salva_preferenze_notifiche(1,true,true,true,ARRAY[30,7,3,0],true,ARRAY[1,0],true,ARRAY[1,0],true) v",[],true)
      assert.equal((await as(owner,counters,[])).rapportini,1)
      // One invocation of the installed runtime wrapper, with all sources eligible.
      await q("INSERT INTO public.utenti_impresa(user_id,ruolo,attivo) VALUES ($1,'titolare',true) ON CONFLICT (user_id) DO UPDATE SET attivo=true,ruolo='titolare'",[owner])
      const fiscal=randomUUID(), agenda=randomUUID(), inspection=randomUUID()
      const tomorrow=(await q("SELECT ((now() AT TIME ZONE 'Europe/Rome')::date+1)::text v"))[0].v
      await as(owner,'SELECT public.crea_scadenza_fiscale($1,$2) v',[fiscal,{
        tipo:'IVA',periodo_riferimento:'Fixture quattro producer',data_scadenza:today,
        importo_previsto:'100.00',stato:'da_pagare',importo_pagato:null,data_pagamento:null,
        note:"Nota fixture",riferimento_documento:"Documento fixture",includi_nei_totali:true
      }],true)
      await q("INSERT INTO public.agenda_attivita(id,user_id,titolo,data,ora_inizio,ora_fine,tipo) VALUES ($1,$2,'Fixture',$3,'11:00','12:00','Altro')",[agenda,owner,tomorrow])
      await q("INSERT INTO public.sopralluoghi(id,cliente,data_sopralluogo,ora_appuntamento,stato) VALUES ($1,'Fixture',$2,'11:00','da_preventivare')",[inspection,tomorrow])
      const obligationId=(await as(owner,resolve,[n])).record_id
      const origins=[fiscal,agenda,inspection,obligationId]
      const sourceSnapshot=async()=>await q(
        "SELECT to_jsonb(s) v FROM artecna_contabilita.scadenze_fiscali s WHERE id=$1 UNION ALL SELECT to_jsonb(a) FROM public.agenda_attivita a WHERE id=$2 UNION ALL SELECT to_jsonb(s) FROM public.sopralluoghi s WHERE id=$3 UNION ALL SELECT to_jsonb(a) FROM artecna_rapportini.attesi a WHERE id=$4",origins)
      const sourceBefore=await sourceSnapshot()
      // Reset only the fixture notification so this wrapper actually publishes all four.
      await q('DELETE FROM artecna_notifiche.notifica WHERE id=$1',[n])
      await q("DELETE FROM artecna_notifiche.evento_notificabile WHERE modulo='rapportini' AND record_id=$1",[obligationId])
      await q('SELECT artecna_notifiche.esegui_generatore_runtime()')
      const events=async()=>await q(
        'SELECT e.modulo,e.record_id,e.id,n.recipient_user_id,n.id AS notifica FROM artecna_notifiche.evento_notificabile e JOIN artecna_notifiche.notifica n ON n.evento_id=e.id WHERE e.record_id=ANY($1::uuid[]) ORDER BY e.modulo,n.id',[origins])
      const first=await events()
      assert.deepEqual([...new Set(first.map(e=>e.modulo))],['agenda','rapportini','scadenziario','sopralluoghi'])
      for(const [i,modulo] of ['scadenziario','agenda','sopralluoghi','rapportini'].entries()) {
        const rows=first.filter(e=>e.modulo===modulo)
        assert.ok(rows.length && rows.every(e=>e.record_id===origins[i] && e.recipient_user_id===owner))
        assert.equal(new Set(rows.map(e=>e.id)).size,1)
      }
      assert.deepEqual(await as(owner,counters,[]),{totale:4,scadenziario:1,agenda:1,sopralluoghi:1,rapportini:1})
      assert.deepEqual(await as(esterno,counters,[]),{totale:0,scadenziario:0,agenda:0,sopralluoghi:0,rapportini:0})
      await q('SELECT artecna_notifiche.esegui_generatore_runtime()')
      assert.deepEqual(await events(),first)
      assert.deepEqual(await sourceSnapshot(),sourceBefore)
      await q('DELETE FROM artecna_notifiche.notifica WHERE evento_id IN (SELECT id FROM artecna_notifiche.evento_notificabile WHERE record_id=ANY($1::uuid[]))',[origins])
      await q('DELETE FROM artecna_notifiche.evento_notificabile WHERE record_id=ANY($1::uuid[])',[origins])
      await q('DELETE FROM artecna_rapportini.attesi WHERE cantiere_id=$1 AND giorno_lavoro=$2',[f.b,prior])
    }
    await q('SET statement_timeout = 8000')
    const generate = "SELECT artecna_notifiche.genera_rapportini_attesi('2026-12-03 21:00+01') v"
    const waitOnLock = async pid => {
      for (let attempt=0; attempt<100; attempt++) {
        if ((await observer.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1",[pid])).rows[0]?.wait_event_type==='Lock') return true
        await new Promise(resolve=>setTimeout(resolve,20))
      }
      return false
    }
    // Explicit timestamps keep the transition matrix independent of the wall clock.
    await q('BEGIN')
    try {
      await q("UPDATE artecna_rapportini.configurazione_attesi SET sospeso=false WHERE cantiere_id=$1",[cantiere])
      const run=async instant=>await q('SELECT artecna_notifiche.genera_rapportini_attesi($1)',[instant])
      const active=async()=> (await q("SELECT n.id,n.titolo,n.read_at,n.archived_at FROM artecna_notifiche.notifica n JOIN artecna_notifiche.evento_notificabile e ON e.id=n.evento_id WHERE e.modulo='rapportini' AND e.record_id=$1 AND n.resolved_at IS NULL",[obligation]))[0]
      await run('2026-12-03 16:59:59+01')
      assert.equal(await active(),undefined)
      await run('2026-12-03 17:00+01')
      assert.equal((await active()).titolo,'Rapportino mancante')
      const report=randomUUID()
      await q("INSERT INTO public.rapportini(id,cantiere_id,data) VALUES($1,$2,'2026-12-03')",[report,cantiere])
      await q("UPDATE artecna_notifiche.notifica SET read_at='2026-12-03 18:00+01',archived_at='2026-12-03 18:01+01' WHERE id=(SELECT id FROM artecna_notifiche.notifica WHERE evento_id=$1)",[target])
      await run('2026-12-03 19:00+01')
      const draft=await active()
      assert.equal(draft.titolo,'Rapportino da chiudere')
      await q("UPDATE public.rapportini SET stato_operativo=NULL WHERE id=$1",[report])
      await run('2026-12-03 19:00+01')
      assert.equal((await active()).titolo,'Rapportino da classificare')
      await q("UPDATE public.rapportini SET stato_operativo='chiuso' WHERE id=$1",[report])
      await run('2026-12-03 20:00+01')
      assert.equal(await active(),undefined)
      await q("UPDATE public.rapportini SET stato_operativo='bozza' WHERE id=$1",[report])
      await run('2026-12-03 20:01+01')
      assert.deepEqual(await active(),draft)
      await q('UPDATE public.cantieri SET lavori_conclusi=true WHERE id=$1',[cantiere])
      await run('2026-12-04 20:00+01')
      assert.equal(await active(),undefined)
      await q('UPDATE public.cantieri SET lavori_conclusi=false WHERE id=$1',[cantiere])
      await run('2026-12-10 17:00+01')
      assert.equal(await active(),undefined)
      assert.equal((await q('SELECT stato_operativo FROM public.rapportini WHERE id=$1',[report]))[0].stato_operativo,'bozza')
      await q('SAVEPOINT termine')
      await q("SELECT set_config('request.jwt.claim.sub',$1,true)",[owner])
      const revision=(await q("SELECT public.modifica_rapportino_atteso($1,$2,1,'18:00',7::smallint) v",[cantiere,obligation]))[0].v
      assert.equal(revision,'2')
      assert.equal((await q("SELECT id FROM artecna_rapportini.attesi WHERE cantiere_id=$1 AND giorno_lavoro='2026-12-03'",[cantiere]))[0].id,obligation)
      await run('2026-12-03 17:59:59+01')
      assert.equal(await active(),undefined)
      await run('2026-12-03 18:00+01')
      const revised=await active()
      assert.equal(revised.titolo,'Rapportino da chiudere')
      assert.notEqual(revised.id,draft.id)
      assert.ok((await q('SELECT resolved_at FROM artecna_notifiche.notifica WHERE id=$1',[draft.id]))[0].resolved_at)
      await run('2026-12-03 18:01+01')
      assert.deepEqual(await active(),revised)
      console.log('PASS cambio termine via RPC, UUID stabile e nuova occorrenza unica')

      const unplanned=randomUUID()
      await q("UPDATE public.rapportini SET stato_operativo='chiuso' WHERE id=$1",[report])
      await q("INSERT INTO public.rapportini(id,cantiere_id,data) VALUES($1,$2,'2026-12-02')",[unplanned,cantiere])
      await q("UPDATE public.rapportini SET stato_operativo='chiuso' WHERE id=$1",[unplanned])
      await run('2026-12-04 18:00+01')
      assert.equal(await active(),undefined)
      assert.equal((await q("SELECT artecna_rapportini.esito_atteso($1,'2026-12-03') v",[cantiere]))[0].v,'soddisfatto')
      assert.equal((await q("SELECT count(*)::int v FROM artecna_rapportini.attesi WHERE cantiere_id=$1",[cantiere]))[0].v,1)
      console.log('PASS retroattivo chiuso pianificato e non pianificato')
      await q('ROLLBACK TO SAVEPOINT termine')
      for(const days of [3,7,15,30,null]) {
        await q('SAVEPOINT rilevanza')
        await q("SELECT set_config('request.jwt.claim.sub',$1,true)",[owner])
        await q("SELECT public.modifica_rapportino_atteso($1,$2,1,'17:00',$3::smallint)",[cantiere,obligation,days])
        const cutoff=(await q('SELECT rilevante_fino_at AS v FROM artecna_rapportini.attesi WHERE id=$1',[obligation]))[0].v
        assert.equal(cutoff?.toISOString() ?? null,days===null ? null : new Date(Date.UTC(2026,11,3+days,16)).toISOString())
        const boundary=cutoff ?? new Date('2028-01-01T00:00:00Z')
        await run(new Date(boundary.getTime()-1000).toISOString())
        assert.equal((await active()).titolo,'Rapportino da chiudere')
        await run(boundary.toISOString())
        assert.equal(Boolean(await active()),days===null)
        assert.equal((await q('SELECT stato_operativo FROM public.rapportini WHERE id=$1',[report]))[0].stato_operativo,'bozza')
        assert.equal((await q("SELECT artecna_rapportini.esito_atteso($1,'2026-12-03') v",[cantiere]))[0].v,'da_chiudere')
        console.log('PASS rilevanza '+(days===null?'senza scadenza':days+' giorni')+', confine e stato operativo')
        await q('ROLLBACK TO SAVEPOINT rilevanza')
      }
      const dates=await q("SELECT artecna_rapportini.istante_attesi(timestamp '2026-10-25 02:30')::text v")
      assert.equal(new Date(dates[0].v).toISOString(),'2026-10-25T01:30:00.000Z')
      await q('SAVEPOINT primavera')
      await assert.rejects(q("SELECT artecna_rapportini.istante_attesi(timestamp '2026-03-29 02:30')"),{code:'22023'})
      await q('ROLLBACK TO SAVEPOINT primavera')
    } finally { await q('ROLLBACK') }
    // Keep the reconciliation transaction open while Hard Delete enters its lock path.
    await db.query('BEGIN')
    await db.query(generate)
    await actor(a,owner)
    const pending = a.query(remove,[cantiere]).then(result=>result.rows[0].v,error=>error)
    const overlapping = await waitOnLock(a.processID)
    await db.query('COMMIT')
    try {
      assert.equal(overlapping,true)
      assert.equal((await pending).eliminato,true)
    } finally { await a.query('ROLLBACK') }
    const before = await snapshot()
    // Reverse order. SKIP LOCKED skips the root held by the deleting transaction.
    await actor(a,owner)
    try {
      assert.equal((await a.query(remove,[cantiere])).rows[0].v.eliminato,true)
      assert.equal((await db.query(generate)).rows[0].v,0)
      await a.query('COMMIT')
    } finally { await a.query('ROLLBACK') }
    assert.equal((await db.query(generate)).rows[0].v,0)
    assert.deepEqual(await snapshot(),before)
    const residuals = (await observer.query(
      "SELECT EXISTS(SELECT FROM public.cantieri WHERE id=$1) OR EXISTS(SELECT FROM artecna_rapportini.configurazione_attesi WHERE cantiere_id=$1) OR EXISTS(SELECT FROM artecna_rapportini.attesi WHERE cantiere_id=$1) OR EXISTS(SELECT FROM artecna_notifiche.evento_notificabile WHERE id=$2) OR EXISTS(SELECT FROM artecna_notifiche.notifica WHERE evento_id=$2) v",
      [cantiere,target]
    )).rows[0].v
    assert.equal(residuals,false)
    assert.deepEqual((await q('SELECT artecna_distruzione.hard_delete_blockers($1) v',[cantiere]))[0].v,[])
  })
`
if (!source.includes(anchor)) throw new Error('Punto di inserimento fixture assente')
const fixture = new Module(filename, module)
fixture.filename = filename
fixture.paths = Module._nodeModulePaths(__dirname)
fixture._compile(source.replace(anchor, () => extension + anchor), filename)
