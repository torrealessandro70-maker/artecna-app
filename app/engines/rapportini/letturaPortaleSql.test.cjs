// Solo PostgreSQL PGlite isolato; nessuna rete, ENV o credenziale reale.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {randomUUID}=require('node:crypto')
const {PGlite}=require('@electric-sql/pglite')
const {fixture,A,B,OP,RAP,V,TOKEN}=require('./fixtureStep3.cjs')
const root=path.resolve(__dirname,'../../..')
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261004_rapportino_lettura_portale.sql'),'utf8')
const backend='artecna_rapportini_backend'
const signature='public.leggi_rapportino_portale(text,uuid,date,uuid)'
const whitelist=[
  'public.crea_sessione_rapportino(text,text)',
  'public.verifica_sessione_rapportino(text,uuid)',
  'public.varianti_rapportino_portale(text,uuid)',
  'public.salva_rapportino_con_prestazioni(jsonb,text)',
  signature
]
const keys=(value,expected)=>assert.deepEqual(Object.keys(value).sort(),expected.split(' ').sort())

test('Lettura portale SQL: contratto, autorizzazione read-only e ACL',async t=>{
  const db=new PGlite()
  const q=async(sql,params=[]) => (await db.query(sql,params)).rows
  const asLogin=async(role,fn)=>{
    await db.exec(`SET SESSION AUTHORIZATION ${role}`)
    try {return await fn()} finally {await db.exec('SET SESSION AUTHORIZATION postgres; RESET ROLE')}
  }
  const call=(date='2026-10-04',id=null,token=TOKEN,cantiere=A)=>
    asLogin(backend,async()=> (await q('SELECT public.leggi_rapportino_portale($1,$2,$3,$4) v',
      [token,cantiere,date,id]))[0].v)
  const rejected=(fn,code)=>assert.rejects(fn,e=>e.code===code)
  const snapshot=async()=>{
    const result={}
    for(const table of ['public.rapportini','public.rapportino_prestazioni','public.timbrature',
      'artecna_rapportini.sessioni_portale','artecna_rapportini.richieste']) {
      result[table]=(await q(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') v FROM ${table} r`))[0].v
    }
    return result
  }
  const run=(name,fn)=>t.test(name,fn)
  try {
    await db.exec(fixture)
    for(const name of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql',
      '20261003_rapportino_backend_pooler.sql']) {
      await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'))
    }
    const historical=()=>q(`SELECT oid,prosrc,proowner,proacl::text,proconfig,prosecdef FROM pg_proc
      WHERE oid IN ('public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,
      'public.crea_sessione_rapportino(text,text)'::regprocedure,
      'public.verifica_sessione_rapportino(text,uuid)'::regprocedure,
      'public.varianti_rapportino_portale(text,uuid)'::regprocedure,
      'artecna_rapportini.autorizza(text,uuid)'::regprocedure) ORDER BY oid`)
    const oldFunctions=await historical(), beforeMigration=await snapshot()
    await db.exec(migration)
    assert.deepEqual(await historical(),oldFunctions)
    assert.deepEqual(await snapshot(),beforeMigration)
    await asLogin(backend,()=>q('SELECT public.crea_sessione_rapportino($1,$2)',['1234',TOKEN]))
    const row=(changes={})=>({prestazione_id:null,chiave_client:randomUUID(),operaio_id:OP,
      ora_inizio:'08:00',ora_fine:'13:00',pausa_minuti:30,lavoro_in_economia:false,variante_id:null,...changes})
    const payload={versione_contratto:1,richiesta_id:randomUUID(),rapportino_id:null,revisione_attesa:null,
      cantiere_id:A,data:'2026-10-04',documento:{note:'Lavoro',materiali:'Cemento',quantita_materiali:'3'},
      prestazioni:{nuove:[row(),row({lavoro_in_economia:true,variante_id:V}),
        row({lavoro_in_economia:true,variante_id:null})],aggiornate:[],rimosse:[]}}
    const write=p=>asLogin(backend,async()=> (await q('SELECT public.salva_rapportino_con_prestazioni($1::jsonb,$2) v',
      [JSON.stringify(p),TOKEN]))[0].v)
    const created=await write(payload)
    await write({...payload,richiesta_id:randomUUID(),rapportino_id:created.rapportino_id,
      revisione_attesa:created.revisione,prestazioni:{nuove:[],aggiornate:[],rimosse:[created.prestazioni[0].prestazione_id]}})
    // Le tre INSERT dello stesso writer condividono now(): pareggio naturale.
    const beforeReads=await snapshot()
    await run('assente: envelope esatto',async()=>{
      assert.deepEqual(await call('2026-10-05'),{versione_lettura:1,cantiere_id:A,data:'2026-10-05',
        presente:false,versione_prestazioni:null,rapportino_id:null,dettaglio:null})
    })
    await run('singolo V0: riferimento senza dettaglio',async()=>{
      assert.deepEqual(await call('2026-09-21'),{versione_lettura:1,cantiere_id:A,data:'2026-09-21',
        presente:true,versione_prestazioni:0,rapportino_id:RAP,dettaglio:null})
    })
    await run('V0 duplicato: più recente; UUID non seleziona il vecchio',async()=>{
      const id=randomUUID()
      await q('INSERT INTO public.rapportini(id,cantiere_id,data,created_at) VALUES($1,$2,$3,$4)',
        [id,A,'2026-09-21','2099-01-01T00:00:00Z'])
      assert.equal((await call('2026-09-21')).rapportino_id,id)
      assert.equal((await call('2026-09-21',id)).rapportino_id,id)
      await rejected(()=>call('2026-09-21',RAP),'PR409')
      await q('DELETE FROM public.rapportini WHERE id=$1',[id])
    })
    await run('V0 pareggio e NULL timestamp: ordine storico DESC con spareggio id',async()=>{
      const ids=['11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999']
      for(const id of ids) await q('INSERT INTO public.rapportini(id,cantiere_id,data,created_at) VALUES($1,$2,$3,NULL)',[id,A,'2026-10-06'])
      assert.equal((await call('2026-10-06')).rapportino_id,ids[1])
      await q('UPDATE public.rapportini SET created_at=$1 WHERE id=$2',['2099-01-01',ids[1]])
      assert.equal((await call('2026-10-06')).rapportino_id,ids[0])
      await q('DELETE FROM public.rapportini WHERE id=ANY($1::uuid[])',[ids])
    })
    let result
    await run('singolo V1: dettaglio e revisione autorevoli',async()=>{
      result=await call()
      assert.equal(result.versione_prestazioni,1)
      assert.equal(result.rapportino_id,created.rapportino_id)
      assert.equal(result.dettaglio.revisione,2)
      assert.deepEqual(result.dettaglio.documento,payload.documento)
    })
    await run('più prestazioni stesso operaio senza deduplicazione',()=>{
      assert.equal(result.dettaglio.prestazioni.length,3)
      assert(result.dettaglio.prestazioni.every(p=>p.operaio_id===OP && p.operaio_nome==='Mario'))
      assert.equal(new Set(result.dettaglio.prestazioni.map(p=>p.prestazione_id)).size,3)
    })
    await run('pausa e ore preservate dal DB',()=>{
      assert(result.dettaglio.prestazioni.every(p=>p.pausa_minuti===30 && p.ore===4.5 && p.ora_inizio==='08:00' && p.ora_fine==='13:00'))
    })
    await run('ordinario',()=>assert(result.dettaglio.prestazioni.some(p=>!p.lavoro_in_economia && p.variante_id===null)))
    await run('Economia con Variante',()=>assert(result.dettaglio.prestazioni.some(p=>p.lavoro_in_economia && p.variante_id===V)))
    await run('Economia persistita senza Variante leggibile',()=>assert(result.dettaglio.prestazioni.some(p=>p.lavoro_in_economia && p.variante_id===null)))
    await run('rimossa presente con revisione e rimossa_at',()=>{
      const removed=result.dettaglio.prestazioni.find(p=>p.prestazione_id===created.prestazioni[0].prestazione_id)
      assert(removed.rimossa_at); assert.equal(removed.revisione,1)
    })
    await run('ordine stabile created_at,id',async()=>{
      const ids=result.dettaglio.prestazioni.map(p=>p.prestazione_id)
      assert.deepEqual(ids,[...ids].sort())
      assert.deepEqual(await call(),result)
      // Verifica anche il criterio primario, indipendente dall'UUID.
      // Fixture temporanea amministrativa: created_at è immutabile nel dominio.
      // Rollback ripristina anche trigger e timestamp, senza alterare la migration.
      await db.exec('BEGIN; ALTER TABLE public.rapportino_prestazioni DISABLE TRIGGER USER;')
      try {
        await q('UPDATE public.rapportino_prestazioni SET created_at=$1 WHERE id=$2',['2000-01-01',ids[2]])
        assert.equal((await call()).dettaglio.prestazioni[0].prestazione_id,ids[2])
      } finally {await db.exec('ROLLBACK')}
    })
    await run('UUID coerente',async()=>assert.deepEqual(await call('2026-10-04',created.rapportino_id),result))
    await run('UUID altra data',()=>rejected(()=>call('2026-10-05',created.rapportino_id),'PR409'))
    await run('UUID altro cantiere',async()=>{
      await q('UPDATE public.cantieri SET lavori_conclusi=false WHERE id=$1',[B])
      await rejected(()=>call('2026-10-04',created.rapportino_id,TOKEN,B),'PR409')
      await q('UPDATE public.cantieri SET lavori_conclusi=true WHERE id=$1',[B])
    })
    await run('ambiguo V0+V1 e V1+V1: conflitto anche con UUID coerente',async()=>{
      const id=randomUUID()
      await q('INSERT INTO public.rapportini(id,cantiere_id,data) VALUES($1,$2,$3)',[id,A,'2026-10-04'])
      await rejected(()=>call(),'PR409')
      await rejected(()=>call('2026-10-04',created.rapportino_id),'PR409')
      await q('UPDATE public.rapportini SET versione_prestazioni=1 WHERE id=$1',[id])
      await rejected(()=>call(),'PR409')
      await q('DELETE FROM public.rapportini WHERE id=$1',[id])
    })
    await run('versione non supportata: errore senza fallback',async()=>{
      // Corruzione simulata soltanto nella fixture locale, poi ripristinata.
      await db.exec('ALTER TABLE public.rapportini DROP CONSTRAINT rapportini_versione_prestazioni_check;')
      try {
        await q('UPDATE public.rapportini SET versione_prestazioni=2 WHERE id=$1',[RAP])
        await rejected(()=>call('2026-09-21'),'22023')
      } finally {
        await q('UPDATE public.rapportini SET versione_prestazioni=0 WHERE id=$1',[RAP])
        await db.exec('ALTER TABLE public.rapportini ADD CONSTRAINT rapportini_versione_prestazioni_check CHECK(versione_prestazioni IN (0,1))')
      }
    })
    await run('sessione assente, malformata o inesistente',async()=>{
      for(const token of [null,'invalid','00'.repeat(32)]) await rejected(()=>call('2026-10-04',null,token),'PR401')
    })
    for(const [label,column,value] of [['scaduta','scade_at','2000-01-01'],['revocata','revocata_at','2000-01-01']]) {
      await run(`sessione ${label}`,async()=>{
        const old=(await q(`SELECT ${column} v FROM artecna_rapportini.sessioni_portale`))[0].v
        const oldCreated=(await q('SELECT created_at v FROM artecna_rapportini.sessioni_portale'))[0].v
        if(column==='scade_at') await q("UPDATE artecna_rapportini.sessioni_portale SET created_at='1999-01-01'")
        await q(`UPDATE artecna_rapportini.sessioni_portale SET ${column}=$1`,[value])
        await rejected(()=>call(),'PR401')
        await q(`UPDATE artecna_rapportini.sessioni_portale SET ${column}=$1`,[old])
        if(column==='scade_at') await q('UPDATE artecna_rapportini.sessioni_portale SET created_at=$1',[oldCreated])
      })
    }
    await run('compilatore disabilitato e sospeso',async()=>{
      await q('UPDATE public.operai SET accesso_portale=false WHERE id=$1',[OP])
      await rejected(()=>call(),'42501')
      await q("UPDATE public.operai SET accesso_portale=true,stato='sospeso' WHERE id=$1",[OP])
      await rejected(()=>call(),'42501')
      await q("UPDATE public.operai SET stato='attivo' WHERE id=$1",[OP])
    })
    await run('cantiere chiuso o inesistente',async()=>{
      for(const id of [B,randomUUID()]) await rejected(()=>call('2026-10-04',null,TOKEN,id),'42501')
    })
    await run('parametri obbligatori e data finita',async()=>{
      await rejected(()=>call(null),'22023')
      await rejected(()=>call('infinity'),'22023')
      await rejected(()=>call('2026-10-04',null,TOKEN,null),'22023')
    })
    await run('LOGIN diverso: postgres, anon, authenticated, service_role negati',async()=>{
      for(const role of ['postgres','anon','authenticated','service_role']) {
        await rejected(()=>asLogin(role,()=>q('SELECT public.leggi_rapportino_portale($1,$2,$3)',[TOKEN,A,'2026-10-04'])),'42501')
      }
      // Nemmeno SET ROLE backend sostituisce il LOGIN originale.
      await db.exec(`SET ROLE ${backend}`)
      try {await rejected(()=>q('SELECT public.leggi_rapportino_portale($1,$2,$3)',[TOKEN,A,'2026-10-04']),'42501')}
      finally {await db.exec('RESET ROLE')}
    })
    await run('READ ONLY: lettura GREEN senza lock',()=>asLogin(backend,async()=>{
      await db.exec('BEGIN READ ONLY')
      try {assert.deepEqual((await q('SELECT public.leggi_rapportino_portale($1,$2,$3) v',[TOKEN,A,'2026-10-04']))[0].v,result)}
      finally {await db.exec('ROLLBACK')}
    }))
    await run('nessuna variazione dati, sessioni, revisioni o idempotenza',async()=>assert.deepEqual(await snapshot(),beforeReads))
    await run('JSON: chiavi esatte e nessun costo/tariffa/token/stato/created_at',()=>{
      keys(result,'versione_lettura cantiere_id data presente versione_prestazioni rapportino_id dettaglio')
      keys(result.dettaglio,'versione_contratto rapportino_id revisione cantiere_id data documento prestazioni')
      keys(result.dettaglio.documento,'note materiali quantita_materiali')
      for(const p of result.dettaglio.prestazioni) keys(p,'prestazione_id chiave_client operaio_id operaio_nome ora_inizio ora_fine pausa_minuti lavoro_in_economia variante_id ore revisione rimossa_at')
    })
    await run('ACL: cinque grant, nessun SELECT/DML/helper/schema privato',async()=>{
      const grants=await q(`SELECT p.oid::regprocedure::text f,a.privilege_type,a.is_grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a
        WHERE a.grantee=$1::regrole`,[backend])
      assert.deepEqual(grants.map(x=>x.f).sort(),whitelist.map(x=>x.replace('public.','')).sort())
      assert(grants.every(x=>x.privilege_type==='EXECUTE' && !x.is_grantable))
      for(const fn of whitelist) assert.equal((await q("SELECT has_function_privilege($1,$2,'EXECUTE') ok",[backend,fn]))[0].ok,true)
      for(const table of ['public.rapportini','public.rapportino_prestazioni','public.timbrature','public.operai','public.varianti_cantiere',
        'artecna_rapportini.sessioni_portale','artecna_rapportini.richieste']) {
        assert.equal((await q("SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') OR has_any_column_privilege($1,$2,'SELECT,INSERT,UPDATE') ok",[backend,table]))[0].ok,false)
        await rejected(()=>asLogin(backend,()=>q(`SELECT * FROM ${table}`)),'42501')
      }
      assert.equal((await q("SELECT has_schema_privilege($1,'artecna_rapportini','USAGE') ok",[backend]))[0].ok,false)
      assert.equal((await q("SELECT has_function_privilege($1,'artecna_rapportini.autorizza_lettura_portale(text,uuid)','EXECUTE') ok",[backend]))[0].ok,false)
      for(const role of ['anon','authenticated','service_role']) assert.equal((await q("SELECT has_function_privilege($1,$2,'EXECUTE') ok",[role,signature]))[0].ok,false)
      assert.equal((await q(`SELECT count(*)::int n FROM pg_auth_members WHERE member=$1::regrole`,[backend]))[0].n,0)
      assert.deepEqual((await q(`SELECT rolsuper,rolinherit,rolbypassrls FROM pg_roles WHERE rolname=$1`,[backend]))[0],
        {rolsuper:false,rolinherit:false,rolbypassrls:false})
      const meta=(await q('SELECT proowner::regrole::text owner,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid=$1::regprocedure',[signature]))[0]
      assert.deepEqual(meta,{owner:'postgres',prosecdef:true,provolatile:'s',proconfig:['search_path=pg_catalog, pg_temp']})
    })
    await run('certificazione post-check ripetibile, funzioni storiche immutate',async()=>{
      await db.exec(migration.slice(migration.indexOf('DO $lettura_check$'),migration.lastIndexOf('COMMIT;')))
      assert.deepEqual(await historical(),oldFunctions)
    })
    await run('corpo funzioni privo di DML, lock, SQL dinamico e GUC',async()=>{
      const bodies=await q(`SELECT prosrc FROM pg_proc WHERE oid IN ($1::regprocedure,$2::regprocedure)`,
        [signature,'artecna_rapportini.autorizza_lettura_portale(text,uuid)'])
      for(const {prosrc} of bodies) {
        const code=prosrc.replace(/--[^\n]*/g,'')
        assert(!/\b(INSERT|UPDATE|DELETE|EXECUTE|FOR\s+(SHARE|UPDATE)|pg_advisory\w*|set_config)\b/i.test(code))
      }
    })
  } finally {await db.close()}
})

test('Migration lettura: rollback con privilegi inattesi e preflight applicazione ripetuta',async t=>{
  const db=new PGlite()
  const q=async(sql,params=[]) => (await db.query(sql,params)).rows
  try {
    await db.exec(fixture)
    // Eccezioni PUBLIC storiche certificate: la nuova migration deve conservarle.
    await db.exec(`CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
      LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END $$;
      CREATE SCHEMA extensions; GRANT USAGE ON SCHEMA extensions TO PUBLIC;
      CREATE VIEW extensions.pg_stat_statements AS SELECT 1 AS calls;
      CREATE VIEW extensions.pg_stat_statements_info AS SELECT 1 AS dealloc;
      GRANT SELECT ON extensions.pg_stat_statements,extensions.pg_stat_statements_info TO PUBLIC;`)
    for(const name of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql',
      '20261003_rapportino_backend_pooler.sql']) {
      await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8'))
    }
    for(const [label,grant,revoke] of [
      ['SELECT tabella',`GRANT SELECT ON public.rapportini TO ${backend}`,`REVOKE SELECT ON public.rapportini FROM ${backend}`],
      ['SELECT colonna',`GRANT SELECT(id) ON public.operai TO ${backend}`,`REVOKE SELECT(id) ON public.operai FROM ${backend}`],
      ['helper privato',`GRANT EXECUTE ON FUNCTION artecna_rapportini.autorizza(text,uuid) TO ${backend}`,
        `REVOKE EXECUTE ON FUNCTION artecna_rapportini.autorizza(text,uuid) FROM ${backend}`],
      ['BYPASSRLS',`ALTER ROLE ${backend} BYPASSRLS`,`ALTER ROLE ${backend} NOBYPASSRLS`]
    ]) {
      await t.test(`post-check rifiuta ${label}; rollback nuove funzioni`,async()=>{
        await db.exec(grant)
        await assert.rejects(()=>db.exec(migration))
        await db.exec('ROLLBACK')
        assert.equal((await q('SELECT to_regprocedure($1) f',[signature]))[0].f,null)
        assert.equal((await q("SELECT to_regprocedure('artecna_rapportini.autorizza_lettura_portale(text,uuid)') f"))[0].f,null)
        await db.exec(revoke)
      })
    }
    await t.test('default ACL permissive neutralizzate, eccezioni PUBLIC conservate',async()=>{
      await db.exec(migration)
      for(const role of ['anon','authenticated','service_role']) {
        assert.equal((await q("SELECT has_function_privilege($1,$2,'EXECUTE') ok",[role,signature]))[0].ok,false)
      }
      assert.equal((await q("SELECT has_function_privilege($1,'public.rls_auto_enable()','EXECUTE') ok",[backend]))[0].ok,true)
      assert.equal((await q("SELECT has_table_privilege($1,'extensions.pg_stat_statements','SELECT') ok",[backend]))[0].ok,true)
    })
    const postcheck=migration.slice(migration.indexOf('DO $lettura_check$'),migration.lastIndexOf('COMMIT;'))
    for(const fn of whitelist) {
      await t.test(`certificazione rifiuta EXECUTE mancante: ${fn}`,async()=>{
        await db.exec('BEGIN')
        await db.exec(`REVOKE EXECUTE ON FUNCTION ${fn} FROM ${backend}`)
        try {await assert.rejects(()=>db.exec(postcheck),/RPC backend/)}
        finally {await db.exec('ROLLBACK')}
      })
    }
    await t.test('grant diretto extra su funzione PUBLIC già eseguibile: rifiutato',async()=>{
      await db.exec('BEGIN')
      await db.exec(`GRANT EXECUTE ON FUNCTION pg_catalog.abs(integer) TO ${backend}`)
      try {await assert.rejects(()=>db.exec(postcheck),/Grant diretto funzione backend fuori elenco/)}
      finally {await db.exec('ROLLBACK')}
    })
    await t.test('grant option su RPC whitelist: rifiutato',async()=>{
      await db.exec('BEGIN')
      await db.exec(`GRANT EXECUTE ON FUNCTION ${signature} TO ${backend} WITH GRANT OPTION`)
      try {await assert.rejects(()=>db.exec(postcheck),/RPC backend|Grant diretto/)}
      finally {await db.exec('ROLLBACK')}
    })
    await t.test('cinque righe ACL con RPC mancante e funzione extra: rifiutate',async()=>{
      await db.exec('BEGIN')
      await db.exec(`REVOKE EXECUTE ON FUNCTION ${whitelist[0]} FROM ${backend};
        GRANT EXECUTE ON FUNCTION pg_catalog.abs(integer) TO ${backend};`)
      try {await assert.rejects(()=>db.exec(postcheck),/RPC backend/)}
      finally {await db.exec('ROLLBACK')}
    })
    await t.test('seconda applicazione rifiutata senza sostituire la funzione',async()=>{
      const before=await q('SELECT prosrc,proacl::text FROM pg_proc WHERE oid=$1::regprocedure',[signature])
      await assert.rejects(()=>db.exec(migration),/già presente/)
      await db.exec('ROLLBACK')
      assert.deepEqual(await q('SELECT prosrc,proacl::text FROM pg_proc WHERE oid=$1::regprocedure',[signature]),before)
    })
  } finally {await db.close()}
})
