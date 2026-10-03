// PostgreSQL isolato: nessuna connessione remota, password o ENV reale.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {randomUUID}=require('node:crypto')
const {PGlite}=require('@electric-sql/pglite')
const {fixture,A,OP,OP2,USER,TOKEN}=require('./fixtureStep3.cjs')
const root=path.resolve(__dirname,'../../..')
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261003_rapportino_backend_pooler.sql'),'utf8')
const step3=fs.readFileSync(path.join(root,'supabase/migrations/20261003_rapportino_servizio_step3.sql'),'utf8').replace(/\r\n/g,'\n')
const originalDeclaration=step3.match(/CREATE FUNCTION public\.salva_rapportino_con_prestazioni\(p_payload jsonb,p_sessione text DEFAULT NULL\)[\s\S]*?\$fn\$;/)[0]
const backend='artecna_rapportini_backend'
const signatures=['crea_sessione_rapportino(text,text)','verifica_sessione_rapportino(text,uuid)',
  'varianti_rapportino_portale(text,uuid)','salva_rapportino_con_prestazioni(jsonb,text)']
const row=(changes={})=>({prestazione_id:null,chiave_client:'backend',operaio_id:OP,
  ora_inizio:'07:30',ora_fine:'12:30',pausa_minuti:0,lavoro_in_economia:false,variante_id:null,...changes})
const payload=(rows=[row()])=>({versione_contratto:1,richiesta_id:randomUUID(),rapportino_id:null,
  revisione_attesa:null,cantiere_id:A,data:'2026-10-03',prestazioni:{nuove:rows,aggiornate:[],rimosse:[]}})

test('Adattamento B: ACL, LOGIN reale, canale, transazione e compatibilità',async t=>{
  const db=new PGlite()
  const q=async(sql,params=[]) => (await db.query(sql,params)).rows
  try {
    await db.exec(fixture)
    // Riproduce le eccezioni PUBLIC certificate, senza indebolire il dominio.
    await db.exec(`CREATE ROLE authenticator NOLOGIN;
      CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END $$;
      CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO PUBLIC;
      CREATE VIEW extensions.pg_stat_statements AS SELECT 1 AS calls;
      CREATE VIEW extensions.pg_stat_statements_info AS SELECT 1 AS dealloc;
      GRANT SELECT ON extensions.pg_stat_statements,extensions.pg_stat_statements_info TO PUBLIC;`)
    for(const name of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql']) {
      await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'))
    }
    const original=(await q("SELECT prosrc FROM pg_proc WHERE oid='public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure"))[0].prosrc.replace(/\r\n/g,'\n')
    const metadata=()=>q("SELECT proowner,prosecdef,proconfig,proargtypes::text,proargnames,prorettype,prolang,pronargdefaults,pg_get_expr(proargdefaults,0) defaults,proacl::text FROM pg_proc WHERE oid='public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure")
    const writerBefore=await metadata()
    const before=(await q('SELECT to_jsonb(r) v FROM public.rapportini r'))[0].v
    await db.exec(migration)
    const run=(name,fn)=>t.test(name,fn)
    const asLogin=async(fn)=>{
      await db.exec(`SET SESSION AUTHORIZATION ${backend}`)
      try { return await fn() } finally { await db.exec('SET SESSION AUTHORIZATION postgres; RESET ROLE') }
    }
    const rejected=async(fn,code='42501')=>assert.rejects(fn,e=>e.code===code)
    const call=(p,token=null)=>q('SELECT public.salva_rapportino_con_prestazioni($1::jsonb,$2) v',[JSON.stringify(p),token]).then(x=>x[0].v)
    await run('ruolo LOGIN minimo, nessuna membership e solo quattro grant EXECUTE diretti',async()=>{
      const r=(await q('SELECT rolcanlogin,rolinherit,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname=$1',[backend]))[0]
      assert.deepEqual(r,{rolcanlogin:true,rolinherit:false,rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false})
      assert.equal((await q('SELECT count(*)::int n FROM pg_auth_members WHERE member=$1::regrole',[backend]))[0].n,0)
      const grants=await q(`SELECT p.oid::regprocedure::text f FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
        WHERE a.grantee=$1::regrole AND a.privilege_type='EXECUTE' ORDER BY f`,[backend])
      assert.deepEqual(grants.map(x=>x.f).sort(),signatures.map(x=>x).sort())
      for(const signature of signatures) assert.equal((await q('SELECT has_function_privilege($1,$2,\'EXECUTE\') ok',[backend,`public.${signature}`]))[0].ok,true)
    })
    await run('PUBLIC preesistente: TEMP/statistiche/rls_auto_enable conservati, niente CREATE',async()=>{
      assert.equal((await q("SELECT has_database_privilege($1,current_database(),'TEMP') ok",[backend]))[0].ok,true)
      assert.equal((await q("SELECT has_schema_privilege($1,'public','CREATE') ok",[backend]))[0].ok,false)
      assert.equal((await q("SELECT has_function_privilege($1,'public.rls_auto_enable()','EXECUTE') ok",[backend]))[0].ok,true)
      assert.equal((await q("SELECT has_table_privilege($1,'extensions.pg_stat_statements','SELECT') ok",[backend]))[0].ok,true)
    })
    await run('SELECT e DML applicativi realmente negati al LOGIN backend',async()=>asLogin(async()=>{
      for(const table of ['operai','cantieri','rapportini','timbrature','rapportino_prestazioni','varianti_cantiere','economia_righe']) {
        for(const sql of [`SELECT * FROM public.${table}`,`DELETE FROM public.${table} WHERE false`,
          `UPDATE public.${table} SET id=id WHERE false`,`INSERT INTO public.${table}(id) VALUES(gen_random_uuid())`]) {
          await rejected(()=>q(sql))
        }
      }
    }))
    await run('schema privato/helper interni negati al LOGIN backend',async()=>asLogin(async()=>{
      await rejected(()=>q('SELECT * FROM artecna_rapportini.sessioni_portale'))
      await rejected(()=>q('SELECT artecna_rapportini.variante_del_cantiere($1,$2)',[A,A]))
      await rejected(()=>q('SELECT artecna_rapportini.applica_prestazioni_rapportino($1::jsonb)',[JSON.stringify(payload())]))
    }))
    await run('SET ROLE privilegiati realmente negati al session_user backend',async()=>asLogin(async()=>{
      for(const role of ['postgres','anon','authenticated','service_role','authenticator','artecna_rapportini_rpc']) {
        await rejected(()=>db.exec(`SET ROLE ${role}`))
      }
    }))
    await run('writer senza sessione rifiutato anche con GUC/JWT owner simulato',async()=>asLogin(async()=>{
      await q("SELECT set_config('test.user',$1,false)",[USER])
      await q("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:USER,role:'authenticated'})])
      await rejected(()=>call(payload()))
      await rejected(()=>call(payload(),''))
      await rejected(()=>call(payload(),'ff'.repeat(32)))
    }))
    let result,p
    await run('PIN login, verifica sessione, Varianti e writer consentiti al backend',async()=>asLogin(async()=>{
      const identity=(await q('SELECT session_user::text s,current_user::text c'))[0]
      assert.deepEqual(identity,{s:backend,c:backend})
      const login=(await q('SELECT public.crea_sessione_rapportino($1,$2) v',['1234',TOKEN]))[0].v
      assert.equal(login.operaio.id,OP)
      assert.equal((await q('SELECT public.verifica_sessione_rapportino($1,$2) v',[TOKEN,A]))[0].v.id,OP)
      assert.equal((await q('SELECT public.varianti_rapportino_portale($1,$2) v',[TOKEN,A]))[0].v.length,1)
      p=payload(); result=await call(p,TOKEN)
      assert.equal(result.prestazioni.length,1)
    }))
    await run('retry commit: stessa testata/prestazione/timbratura/costo',async()=>{
      assert.deepEqual(await asLogin(()=>call(p,TOKEN)),result)
      const count=(await q(`SELECT (SELECT count(*) FROM public.rapportini WHERE id=$1)::int r,
        (SELECT count(*) FROM public.rapportino_prestazioni WHERE rapportino_id=$1)::int p,
        (SELECT count(*) FROM public.timbrature WHERE rapportino_id=$1)::int t`,[result.rapportino_id]))[0]
      assert.deepEqual(count,{r:1,p:1,t:1})
      assert.equal((await q('SELECT costo_manodopera FROM public.rapportini WHERE id=$1',[result.rapportino_id]))[0].costo_manodopera,100)
    })
    await run('errore batch: rollback completo di testata, fotografie e idempotenza',async()=>{
      await q('UPDATE public.operai SET costo_orario=NULL WHERE id=$1',[OP2])
      const p=payload([row(),row({chiave_client:'seconda',operaio_id:OP2})]); p.data='2026-10-04'
      await asLogin(()=>rejected(()=>call(p,TOKEN),'22023'))
      assert.equal((await q("SELECT count(*)::int n FROM public.rapportini WHERE data='2026-10-04'"))[0].n,0)
      assert.equal((await q('SELECT count(*)::int n FROM artecna_rapportini.richieste WHERE richiesta_id=$1',[p.richiesta_id]))[0].n,0)
      assert.equal((await q('SELECT count(*)::int n FROM public.rapportino_prestazioni'))[0].n,1)
    })
    await run('desktop authenticated conserva writer e revisione aggregata',async()=>{
      await q("SELECT set_config('test.user',$1,false)",[USER])
      await db.exec('SET ROLE authenticated')
      try {
        const edited=await call({...p,richiesta_id:randomUUID(),rapportino_id:result.rapportino_id,
          revisione_attesa:result.revisione,prestazioni:{nuove:[],aggiornate:[],rimosse:[]},documento:{note:'Desktop'}})
        assert.equal(edited.revisione,result.revisione+1)
      } finally { await db.exec('RESET ROLE') }
    })
    await run('guardia unica modifica corpo writer; owner/search_path/ACL/legacy conservati',async()=>{
      const writer=(await q("SELECT prosrc,proowner::regrole::text owner,prosecdef,proconfig FROM pg_proc WHERE oid='public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure"))[0]
      const stripped=writer.prosrc.replace(/  -- Connessione dedicata:[\s\S]*?  END IF;\n/,'')
      assert.equal(stripped,original)
      const writerAfter=await metadata()
      writerAfter[0].proacl=writerAfter[0].proacl.replace(',artecna_rapportini_backend=X/postgres','')
      assert.deepEqual(writerAfter,writerBefore)
      assert(!/\boverlay\s*\(|EXECUTE\s+format\s*\(/i.test(migration))
      assert.equal((migration.match(/Grant diretto funzione backend fuori elenco/g)||[]).length,1)
      assert.equal((migration.match(/Funzione SECURITY DEFINER accessibile oltre alle eccezioni PUBLIC certificate/g)||[]).length,1)
      assert.equal(writer.owner,'postgres'); assert.equal(writer.prosecdef,true)
      assert.deepEqual(writer.proconfig,['search_path=pg_catalog, pg_temp'])
      assert.deepEqual((await q('SELECT to_jsonb(r) v FROM public.rapportini r WHERE versione_prestazioni=0'))[0].v,before)
      for(const f of signatures) assert.equal((await q("SELECT has_function_privilege('service_role',$1,'EXECUTE') ok",[`public.${f}`]))[0].ok,true)
    })
    await run('sequenze negate e nessun nuovo grant ereditato dai default legacy',async()=>{
      await db.exec('CREATE SEQUENCE public.legacy_seq')
      assert.equal((await q("SELECT has_sequence_privilege($1,'public.legacy_seq','USAGE,SELECT,UPDATE') ok",[backend]))[0].ok,false)
      await asLogin(()=>rejected(()=>q("SELECT nextval('public.legacy_seq')")))
    })
  } finally {await db.close()}
})

test('Preflight versione writer e rollback integrale prima/dopo CREATE ROLE',async t=>{
  const db=new PGlite()
  const q=async(sql,params=[]) => (await db.query(sql,params)).rows
  const snapshot=()=>q("SELECT prosrc,proowner,prosecdef,proconfig,pg_get_expr(proargdefaults,0) defaults,proacl::text FROM pg_proc WHERE oid='public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure")
  try {
    await db.exec(fixture)
    await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261003_rapportino_prestazioni_step2.sql'),'utf8'))
    await db.exec(step3)
    const baseline=await snapshot()
    const tests=[
      ['corpo di versione sconosciuta',()=>db.exec(originalDeclaration.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace('\nBEGIN\n','\nBEGIN\n  -- versione sconosciuta\n'))],
      ['SECURITY INVOKER inatteso',()=>db.exec('ALTER FUNCTION public.salva_rapportino_con_prestazioni(jsonb,text) SECURITY INVOKER')],
      ['search_path inatteso',()=>db.exec('ALTER FUNCTION public.salva_rapportino_con_prestazioni(jsonb,text) SET search_path TO public')],
      ['owner inatteso',async()=>{await db.exec('CREATE ROLE test_owner NOLOGIN; ALTER FUNCTION public.salva_rapportino_con_prestazioni(jsonb,text) OWNER TO test_owner')}],
      ['DEFAULT inatteso',()=>db.exec(originalDeclaration.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION').replace('p_sessione text DEFAULT NULL',"p_sessione text DEFAULT 'inatteso'"))],
    ]
    for(const [name,mutate] of tests) await t.test(name,async()=>{
      await mutate()
      const unknown=await snapshot()
      await assert.rejects(()=>db.exec(migration),e=>/divergenti|inattesa/.test(e.message))
      await db.exec('ROLLBACK')
      assert.deepEqual(await snapshot(),unknown)
      assert.equal((await q("SELECT count(*)::int n FROM pg_roles WHERE rolname='artecna_rapportini_backend'"))[0].n,0)
      await db.exec('ALTER FUNCTION public.salva_rapportino_con_prestazioni(jsonb,text) OWNER TO postgres')
      await db.exec(originalDeclaration.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'))
    })
    await t.test('errore post-check: rollback ruolo/ACL/writer e dati invariati',async()=>{
      // Questa ACL PUBLIC inattesa causa errore dopo CREATE ROLE e sostituzione.
      await db.exec('GRANT SELECT ON public.operai TO PUBLIC')
      const writer=await snapshot(),data=await q('SELECT to_jsonb(r) v FROM public.rapportini r')
      await assert.rejects(()=>db.exec(migration),e=>/Tabella\/colonna accessibile/.test(e.message))
      await db.exec('ROLLBACK')
      assert.deepEqual(await snapshot(),writer)
      assert.deepEqual(await q('SELECT to_jsonb(r) v FROM public.rapportini r'),data)
      assert.equal((await q("SELECT count(*)::int n FROM pg_roles WHERE rolname='artecna_rapportini_backend'"))[0].n,0)
      await db.exec('REVOKE SELECT ON public.operai FROM PUBLIC')
      assert.equal((await snapshot())[0].prosrc,baseline[0].prosrc)
    })
  } finally {await db.close()}
})

test('Adattamento B installabile come postgres NOSUPERUSER senza assumere il backend',async()=>{
  const db=new PGlite()
  try {
    await db.exec(`CREATE ROLE test_supervisor SUPERUSER NOLOGIN; SET SESSION AUTHORIZATION test_supervisor;
      ALTER ROLE postgres RENAME TO test_bootstrap;
      CREATE ROLE postgres NOSUPERUSER CREATEROLE NOLOGIN NOBYPASSRLS NOINHERIT;
      ALTER SCHEMA public OWNER TO postgres`)
    const database=(await db.query('SELECT current_database() d')).rows[0].d.replaceAll('"','""')
    await db.exec(`ALTER DATABASE "${database}" OWNER TO postgres; SET SESSION AUTHORIZATION postgres`)
    await db.exec(fixture)
    for(const file of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql']) {
      await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'))
    }
    await db.exec(migration)
    assert(!/^\s*SET\s+(?:LOCAL\s+)?ROLE\b/im.test(migration))
    assert(!/ALTER\s+FUNCTION[\s\S]*?OWNER\s+TO/i.test(migration))
    assert.equal((await db.query("SELECT pg_has_role('artecna_rapportini_backend','artecna_rapportini_rpc','MEMBER') v")).rows[0].v,false)
  } finally {await db.close()}
})
