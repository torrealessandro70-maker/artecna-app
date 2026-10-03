// PostgreSQL isolato: nessun ENV/login/Supabase o dato remoto.
// NODE_PATH deve includere il runtime con @electric-sql/pglite.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { PGlite } = require('@electric-sql/pglite')
const sql = fs.readFileSync(path.resolve(__dirname, '../../../supabase/migrations/20261003_rapportino_prestazioni_step2.sql'), 'utf8')
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const OP='cccccccc-cccc-4ccc-8ccc-cccccccccccc', RAP='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const V='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', V2='ffffffff-ffff-4fff-8fff-ffffffffffff'
const USER='11111111-1111-4111-8111-111111111111', REQ='22222222-2222-4222-8222-222222222222'
const REQ2='33333333-3333-4333-8333-333333333333'
const row=(changes={})=>({prestazione_id:null,chiave_client:'riga-a',operaio_id:OP,ora_inizio:'07:30',ora_fine:'12:30',pausa_minuti:0,lavoro_in_economia:false,variante_id:null,...changes})
const payload=(changes={})=>({versione_contratto:1,richiesta_id:REQ,rapportino_id:RAP,revisione_attesa:0,cantiere_id:A,data:'2026-09-21',prestazioni:{nuove:[row()],aggiornate:[],rimosse:[]},...changes})

test('STEP 2: identità, revisioni, idempotenza, vincoli e ACL', async t=>{
  const db=new PGlite()
  try {
    const fixture=`
      CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN;
      CREATE SCHEMA artecna_guardie;
      CREATE TABLE public.cantieri(id uuid PRIMARY KEY);
      CREATE TABLE public.utenti_cantiere(cantiere_id uuid,user_id uuid,ruolo text);
      CREATE TABLE public.operai(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
      CREATE TABLE public.rapportini(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),cantiere_id uuid REFERENCES public.cantieri(id),data date,costo_manodopera double precision DEFAULT 0);
      CREATE TABLE public.varianti_cantiere(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),cantiere_id uuid NOT NULL REFERENCES public.cantieri(id) ON DELETE RESTRICT,numero integer,titolo text NOT NULL,stato text NOT NULL);
      ALTER TABLE public.varianti_cantiere ENABLE ROW LEVEL SECURITY;
      CREATE TABLE public.timbrature(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),cantiere_id uuid REFERENCES public.cantieri(id),rapportino_id uuid,operaio_id uuid,ora_entrata text,ora_uscita text,data text NOT NULL,pausa_minuti integer NOT NULL DEFAULT 0);
      CREATE TABLE public.economia_raccolte(id uuid PRIMARY KEY,revisione bigint);
      CREATE TABLE public.economia_righe(id uuid PRIMARY KEY,quantita numeric,prezzo_unitario numeric);
      CREATE FUNCTION artecna_guardie.utente_jwt_corrente() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
      CREATE FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT EXISTS(SELECT 1 FROM public.utenti_cantiere WHERE user_id=$1 AND cantiere_id=$2 AND ruolo='owner') $$;
      -- Simula i default privileges permissivi realmente segnalati.
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated;
      GRANT ALL ON public.rapportini,public.timbrature,public.operai TO anon,authenticated;
      INSERT INTO public.cantieri VALUES('${A}'),('${B}');
      INSERT INTO public.utenti_cantiere VALUES('${A}','${USER}','owner');
      INSERT INTO public.operai VALUES('${OP}');
      INSERT INTO public.rapportini VALUES('${RAP}','${A}','2026-09-21',100);
      INSERT INTO public.timbrature VALUES('${OP}','${A}','${RAP}','${OP}','07:30','12:30','2026-09-21',0);
      INSERT INTO public.varianti_cantiere VALUES('${V}','${A}',NULL,'Variante A','bozza'),('${V2}','${B}',1,'Variante B','bozza');
      INSERT INTO public.economia_raccolte VALUES('${A}',3);
      INSERT INTO public.economia_righe VALUES('${B}',5,35);
    `
    await db.exec(fixture)
    const snapshot=async()=>{
      const out={}
      for(const table of ['rapportini','timbrature','economia_raccolte','economia_righe']) {
        out[table]=(await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY id),'[]') v FROM public.${table} x`)).rows[0].v
      }
      return out
    }
    const before=await snapshot()
    // PGlite usa normalmente postgres SUPERUSER e mascherava l'errore remoto.
    // Riproduciamo l'installer NOSUPERUSER/CREATEROLE, senza SET sull'owner
    // candidato. PostgreSQL non consente di demotare il bootstrap superuser:
    // un secondo DB in memoria usa un NUOVO ruolo postgres non-superuser.
    // Queste operazioni di harness non fanno parte della migration.
    await t.test('installer non-superuser: errore ownership riprodotto e migration senza SET ROLE',async()=>{
      assert(!/ALTER\s+FUNCTION[\s\S]*?OWNER\s+TO/i.test(sql))
      assert(!/^\s*SET\s+(?:LOCAL\s+)?ROLE\b/im.test(sql))
      assert(!/^\s*GRANT\s+artecna_rapportini_rpc\s+TO\b/im.test(sql))
      const installer=new PGlite()
      try {
        await installer.exec(`
          CREATE ROLE step2_supervisor SUPERUSER NOLOGIN;
          SET SESSION AUTHORIZATION step2_supervisor;
          ALTER ROLE postgres RENAME TO step2_bootstrap;
          CREATE ROLE postgres NOSUPERUSER CREATEROLE NOBYPASSRLS NOINHERIT NOLOGIN;
          ALTER SCHEMA public OWNER TO postgres;
        `)
        await installer.exec(`GRANT CREATE ON DATABASE "${(await installer.query('SELECT current_database() d')).rows[0].d.replaceAll('"','""')}" TO postgres`)
        await installer.exec('SET SESSION AUTHORIZATION postgres')
        await installer.exec(fixture)
        await installer.exec(`
          CREATE ROLE step2_owner_probe NOLOGIN;
          GRANT CREATE ON SCHEMA public TO step2_owner_probe;
          CREATE FUNCTION public.step2_ownership_probe() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;
        `)
        const context=(await installer.query("SELECT current_user,session_user,rolsuper,pg_has_role('postgres','step2_owner_probe','SET') can_set FROM pg_roles WHERE rolname='postgres'")).rows[0]
        assert.deepEqual(context,{current_user:'postgres',session_user:'postgres',rolsuper:false,can_set:false})
        await assert.rejects(()=>installer.exec('ALTER FUNCTION public.step2_ownership_probe() OWNER TO step2_owner_probe'),
          e=>e.code==='42501' && /must be able to SET ROLE/.test(e.message))
        await installer.exec(sql)
        assert.equal((await installer.query("SELECT pg_has_role('postgres','artecna_rapportini_rpc','SET') can_set")).rows[0].can_set,false)
        const owners=(await installer.query("SELECT pg_get_userbyid(proowner) owner FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace")).rows
        assert.equal(owners.length,6); assert(owners.every(x=>x.owner==='postgres'))
      } finally { await installer.close() }
    })
    await db.exec(sql)
    const after=await snapshot()
    assert.deepEqual(after.rapportini.map(({versione_prestazioni,revisione_prestazioni,...r})=>r),before.rapportini)
    assert.deepEqual(after.timbrature.map(({prestazione_rapportino_id,...r})=>r),before.timbrature)
    assert.deepEqual(after.economia_righe,before.economia_righe)
    assert.deepEqual(after.economia_raccolte,before.economia_raccolte)
    const call=async p=>{
      // Esecuzione di dominio, non simulazione di una RPC accessibile al browser.
      await db.exec('SET ROLE artecna_rapportini_rpc')
      try { return (await db.query('SELECT artecna_rapportini.applica_prestazioni_rapportino($1::jsonb) v',[JSON.stringify(p)])).rows[0].v }
      finally { await db.exec('RESET ROLE').catch(()=>{}) /* L'errore SQL originale resta visibile; rollback al savepoint ripristina il ruolo. */ }
    }
    const reject=async (fn,code)=>{
      await db.exec('SAVEPOINT expected_error')
      try { await assert.rejects(fn,e=>code ? e.code===code : !!e.code) }
      finally { await db.exec('ROLLBACK TO SAVEPOINT expected_error; RELEASE SAVEPOINT expected_error') }
    }
    const run=async(name,fn)=>t.test(name,async()=>{
      await db.exec('BEGIN')
      await db.query("SELECT set_config('test.user',$1,true)",[USER])
      try { await fn() } finally { await db.exec('ROLLBACK') }
    })
    await run('creazione UUID e ore server',async()=>{
      const r=await call(payload()); assert.match(r.prestazioni[0].prestazione_id,/^[a-f0-9-]{36}$/)
      assert.equal(r.prestazioni[0].ore,5); assert.equal(r.revisione,1)
    })
    await run('modifica conserva UUID e incrementa revisioni',async()=>{
      const first=await call(payload()), id=first.prestazioni[0].prestazione_id
      const r=await call(payload({richiesta_id:REQ2,revisione_attesa:1,prestazioni:{nuove:[],aggiornate:[row({prestazione_id:id,ora_fine:'13:00'})],rimosse:[]}}))
      assert.equal(r.prestazioni[0].prestazione_id,id); assert.equal(r.prestazioni[0].revisione,1)
      assert.equal(r.prestazioni[0].ore,5.5); assert.equal(r.revisione,2)
    })
    await run('due intervalli stesso operaio, UUID distinti',async()=>{
      const r=await call(payload({prestazioni:{nuove:[row(),row({chiave_client:'riga-b',ora_inizio:'14:00',ora_fine:'16:00'})],aggiornate:[],rimosse:[]}}))
      assert.equal(r.prestazioni.length,2); assert.notEqual(r.prestazioni[0].prestazione_id,r.prestazioni[1].prestazione_id)
    })
    for(const [name,changes] of [
      ['pausa negativa',{pausa_minuti:-1}],['intervallo inverso',{ora_fine:'06:00'}],
      ['mezzanotte rifiutata',{ora_inizio:'23:00',ora_fine:'01:00'}],['secondi rifiutati',{ora_inizio:'07:30:15'}],
      ['pausa intero intervallo',{pausa_minuti:300}],['ordinario con Variante',{variante_id:V}],
      ['Variante altro cantiere',{lavoro_in_economia:true,variante_id:V2}],
      ['operaio inesistente',{operaio_id:B}],['ore client rifiutate',{ore:999}],
      ['stato Economia client rifiutato',{stato_economia:'economia_gia_inserita'}]
    ]) await run(name,()=>reject(()=>call(payload({prestazioni:{nuove:[row(changes)],aggiornate:[],rimosse:[]}}))))
    await run('Rapportino inesistente',()=>reject(()=>call(payload({rapportino_id:B}))))
    await run('rimozione logica conserva UUID e provenienza',async()=>{
      const r=await call(payload()),id=r.prestazioni[0].prestazione_id
      const removed=await call(payload({richiesta_id:REQ2,revisione_attesa:1,prestazioni:{nuove:[],aggiornate:[],rimosse:[id]}}))
      assert.equal(removed.prestazioni[0].prestazione_id,id); assert(removed.prestazioni[0].rimossa_at)
      assert.equal(removed.prestazioni[0].chiave_client,'riga-a'); assert.equal(removed.prestazioni[0].revisione,1)
    })
    await run('stessa richiesta e payload restituiscono esito identico',async()=>{
      const r=await call(payload()); assert.deepEqual(await call(payload()),r)
      assert.equal((await db.query('SELECT count(*) n FROM public.rapportino_prestazioni')).rows[0].n,1)
    })
    await run('stessa richiesta payload differente PR409',async()=>{
      await call(payload()); await reject(()=>call(payload({data:'2026-09-22'})),'PR409')
    })
    await run('stessa chiave con nuova richiesta non crea nuovo UUID',async()=>{
      const r=await call(payload()),next=await call(payload({richiesta_id:REQ2,revisione_attesa:1}))
      assert.deepEqual(next,r)
    })
    await run('chiave già usata con altri dati PR409',async()=>{
      await call(payload()); await reject(()=>call(payload({richiesta_id:REQ2,revisione_attesa:1,prestazioni:{nuove:[row({ora_fine:'13:00'})],aggiornate:[],rimosse:[]}})),'PR409')
    })
    await run('revisione obsoleta PR412 senza scritture',async()=>{
      const p=payload({prestazioni:{nuove:[row(),row({chiave_client:'riga-b'})],aggiornate:[],rimosse:[]}})
      const r=await call(p),a=r.prestazioni.find(x=>x.chiave_client==='riga-a'),b=r.prestazioni.find(x=>x.chiave_client==='riga-b')
      const updated=await call(payload({richiesta_id:REQ2,revisione_attesa:1,prestazioni:{nuove:[],aggiornate:[row({prestazione_id:a.prestazione_id,ora_fine:'13:00'})],rimosse:[]}}))
      assert.equal(updated.prestazioni.find(x=>x.chiave_client==='riga-b').revisione,0)
      // Anche una riga rimasta invariata non può essere aggiornata usando una
      // revisione obsoleta del Rapportino: il locking è volutamente aggregato.
      await reject(()=>call(payload({richiesta_id:'44444444-4444-4444-8444-444444444444',revisione_attesa:1,
        prestazioni:{nuove:[],aggiornate:[row({prestazione_id:b.prestazione_id,chiave_client:'riga-b',ora_fine:'13:00'})],rimosse:[]}})),'PR412')
      assert.deepEqual(await call(payload({richiesta_id:REQ2,revisione_attesa:1,prestazioni:{nuove:[],aggiornate:[row({prestazione_id:a.prestazione_id,ora_fine:'13:00'})],rimosse:[]}})),updated)
    })
    await run('errore nella seconda prestazione: rollback completo',async()=>{
      const snap=await snapshot()
      await reject(()=>call(payload({prestazioni:{nuove:[row(),row({chiave_client:'riga-b',operaio_id:B})],aggiornate:[],rimosse:[]}})))
      assert.deepEqual(await snapshot(),snap)
      assert.equal((await db.query('SELECT count(*) n FROM public.rapportino_prestazioni')).rows[0].n,0)
      assert.equal((await db.query('SELECT count(*) n FROM artecna_rapportini.richieste')).rows[0].n,0)
    })
    await run('omissione non cancella, Economia/KPI/timbrature invariati',async()=>{
      const snap=await snapshot(),r=await call(payload())
      const next=await call(payload({richiesta_id:REQ2,revisione_attesa:1,prestazioni:{nuove:[],aggiornate:[],rimosse:[]}}))
      assert.equal(next.prestazioni.length,1); assert.deepEqual(next,r)
      const end=await snapshot()
      assert.equal(end.rapportini[0].costo_manodopera,100)
      for(const table of ['timbrature','economia_righe','economia_raccolte']) assert.deepEqual(end[table],snap[table])
    })
    await run('owner assente/cantiere non autorizzato',async()=>{
      await reject(()=>call(payload({cantiere_id:B})),'42501')
      await db.query("SELECT set_config('test.user','',true)")
      await reject(()=>call(payload()),'42501')
    })
    await run('ACL: anon e authenticated senza DML, helper privati',async()=>{
      for(const role of ['anon','authenticated']) {
        const acl=(await db.query(`SELECT has_table_privilege($1,'public.rapportino_prestazioni','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') d,
          has_function_privilege($1,'artecna_rapportini.proteggi_prestazione()','EXECUTE') h,
          has_function_privilege($1,'artecna_rapportini.applica_prestazioni_rapportino(jsonb)','EXECUTE') w,
          has_function_privilege($1,'artecna_rapportini.variante_del_cantiere(uuid,uuid)','EXECUTE') v`,[role])).rows[0]
        assert.equal(acl.d,false); assert.equal(acl.h,false); assert.equal(acl.w,false); assert.equal(acl.v,false)
        await reject(async()=>{ await db.exec(`SET ROLE ${role}`); try { await db.query('SELECT artecna_rapportini.applica_prestazioni_rapportino($1::jsonb)',[JSON.stringify(payload())]) } finally { await db.exec('RESET ROLE').catch(()=>{}) } },'42501')
        await reject(async()=>{ await db.exec(`SET ROLE ${role}`); try { await db.query('SELECT artecna_rapportini.variante_del_cantiere($1,$2)',[V,A]) } finally { await db.exec('RESET ROLE').catch(()=>{}) } },'42501')
      }
      assert.equal((await db.query("SELECT to_regprocedure('public.applica_prestazioni_rapportino(jsonb)') x")).rows[0].x,null)
      const role=(await db.query("SELECT rolbypassrls FROM pg_roles WHERE rolname='artecna_rapportini_rpc'")).rows[0]
      assert.equal(role.rolbypassrls,false)
      // Senza policy Variante e senza BYPASSRLS il dominio non legge la tabella;
      // il solo helper amministrativo risponde a esistenza/appartenenza.
      await reject(async()=>{ await db.exec('SET ROLE artecna_rapportini_rpc'); try { await db.exec('SELECT id,cantiere_id FROM public.varianti_cantiere') } finally { await db.exec('RESET ROLE').catch(()=>{}) } },'42501')
      await db.exec('SET ROLE artecna_rapportini_rpc')
      try {
        const checks=(await db.query('SELECT artecna_rapportini.variante_del_cantiere($1,$2) ok,artecna_rapportini.variante_del_cantiere($1,$3) wrong,artecna_rapportini.variante_del_cantiere($3,$2) absent',[V,A,B])).rows[0]
        assert.deepEqual(checks,{ok:true,wrong:false,absent:false})
      } finally { await db.exec('RESET ROLE') }
      await reject(async()=>{ await db.exec('SET ROLE anon'); try { await db.exec('INSERT INTO public.rapportino_prestazioni DEFAULT VALUES') } finally { await db.exec('RESET ROLE').catch(()=>{}) } },'42501')
    })
    await run('identità e contesto immutabili anche fuori RPC',async()=>{
      await call(payload())
      await reject(()=>db.exec(`UPDATE public.rapportino_prestazioni SET id='${B}'`),'PR403')
      await reject(()=>db.exec(`UPDATE public.rapportino_prestazioni SET rapportino_id='${B}'`),'PR403')
      await reject(()=>db.exec(`UPDATE public.rapportini SET cantiere_id='${B}' WHERE id='${RAP}'`),'PR403')
      await reject(()=>db.exec('DELETE FROM public.rapportino_prestazioni'),'PR403')
    })
    await run('Variante non trasferibile dopo collegamento',async()=>{
      await call(payload({prestazioni:{nuove:[row({lavoro_in_economia:true,variante_id:V})],aggiornate:[],rimosse:[]}}))
      await reject(()=>db.exec(`UPDATE public.varianti_cantiere SET cantiere_id='${B}' WHERE id='${V}'`),'PR403')
    })
    await run('timbrature nullable, FK solo sul nuovo riferimento',async()=>{
      const constraints=(await db.query("SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid='public.timbrature'::regclass AND contype='f'")).rows.map(x=>x.d)
      assert(constraints.some(x=>x.includes('prestazione_rapportino_id')))
      assert(!constraints.some(x=>x.startsWith('FOREIGN KEY (rapportino_id)')))
      assert(!constraints.some(x=>x.startsWith('FOREIGN KEY (operaio_id)')))
    })
    await run('proiezione timbratura coerente e riservata al dominio',async()=>{
      const r=await call(payload()),id=r.prestazioni[0].prestazione_id
      await db.query('UPDATE public.timbrature SET prestazione_rapportino_id=$1 WHERE id=$2',[id,OP])
      await reject(()=>db.exec(`UPDATE public.timbrature SET operaio_id='${B}' WHERE id='${OP}'`),'22023')
      await reject(async()=>{ await db.exec('SET ROLE anon'); try { await db.exec(`UPDATE public.timbrature SET prestazione_rapportino_id=NULL WHERE id='${OP}'`) } finally { await db.exec('RESET ROLE').catch(()=>{}) } },'PR403')
    })
    await run('percorsi legacy restano operativi, nuovi metadati protetti',async()=>{
      await db.exec('SET ROLE anon')
      await db.exec(`UPDATE public.rapportini SET data='2026-09-22' WHERE id='${RAP}'`)
      await db.exec(`UPDATE public.timbrature SET ora_uscita='13:00' WHERE id='${OP}'`)
      await db.exec('RESET ROLE')
      await reject(async()=>{ await db.exec('SET ROLE anon'); try { await db.exec(`UPDATE public.rapportini SET versione_prestazioni=1 WHERE id='${RAP}'`) } finally { await db.exec('RESET ROLE').catch(()=>{}) } },'PR403')
      assert.equal((await db.query('SELECT versione_prestazioni v FROM public.rapportini WHERE id=$1',[RAP])).rows[0].v,0)
    })
    assert.deepEqual(await snapshot(),after,'Tutti i casi isolati lasciano lo storico invariato')
  } finally { await db.close() }
})
