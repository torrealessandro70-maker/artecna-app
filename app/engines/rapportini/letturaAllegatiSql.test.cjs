// Solo PostgreSQL isolati locali; nessuna credenziale di progetto o Storage.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path')
const {randomUUID}=require('node:crypto')
const {PGlite}=require('@electric-sql/pglite')
const {fixture,A,B,RAP,OP,TOKEN}=require('./fixtureStep3.cjs')
const dir=path.resolve(__dirname,'../../../supabase/migrations')
const sql=fs.readFileSync(path.join(dir,'20261004_rapportino_allegati_lettura.sql'),'utf8')
const signature='public.autorizza_accesso_allegato_portale(text,uuid)'
const listSignature='public.elenca_allegati_rapportino_portale(text,uuid,uuid,date)'
const helperSignature='artecna_rapportini.accesso_allegato_finalizzato(uuid,uuid,uuid,date)'
const callSql='SELECT public.autorizza_accesso_allegato_portale($1,$2) v'
const listSql='SELECT public.elenca_allegati_rapportino_portale($1,$2,$3,$4) v'
const reserveSql='SELECT public.prenota_allegato_rapportino_portale($1,$2,$3,$4,$5,$6,$7,$8) v'
const photoSchema=`CREATE TABLE public.foto_cantiere(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cantiere_id uuid REFERENCES public.cantieri(id),cantiere text,rapportino_id text,sopralluogo_id text,
  categoria text,data_foto text,nota text,file_url text,file_path text,immagine_base64 text,
  thumbnail_url text,storage_provider text,sync_status text,created_at timestamptz DEFAULT now());`
const whitelist=[
  'crea_sessione_rapportino(text,text)','verifica_sessione_rapportino(text,uuid)',
  'varianti_rapportino_portale(text,uuid)','salva_rapportino_con_prestazioni(jsonb,text)',
  'leggi_rapportino_portale(text,uuid,date,uuid)',
  'prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint)',
  'finalizza_allegato_rapportino_portale(text,uuid,uuid)',
  'elenca_allegati_rapportino_portale(text,uuid,uuid,date)','autorizza_accesso_allegato_portale(text,uuid)']
async function setup(db){
  await db.exec(fixture);await db.exec(photoSchema)
  for(const name of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql',
    '20261003_rapportino_backend_pooler.sql','20261004_rapportino_lettura_portale.sql',
    '20261004_rapportino_allegati_registro.sql','20261004_rapportino_allegati_prenotazione.sql',
    '20261004_rapportino_allegati_finalizzazione.sql'])
    await db.exec(fs.readFileSync(path.join(dir,name),'utf8'))
  await db.query("INSERT INTO artecna_rapportini.sessioni_portale(token_sha256,operaio_id,scade_at) VALUES(sha256(convert_to($1,'UTF8')),$2,statement_timestamp()+interval '8 hours')",[TOKEN,OP])
  await db.exec(`UPDATE public.rapportini SET versione_prestazioni=1 WHERE id='${RAP}'`)
}
async function historical(db){return (await db.query(`SELECT oid,pg_get_functiondef(oid) def,proowner,proacl::text FROM pg_proc
  WHERE (pronamespace='artecna_rapportini'::regnamespace AND proname<>'accesso_allegato_finalizzato') OR oid IN (${whitelist.slice(0,7).map(s=>`'public.${s}'::regprocedure`).join(',')}) ORDER BY oid`)).rows}
async function domain(db){
  const r={}
  for(const table of ['public.rapportini','public.rapportino_prestazioni','public.timbrature','public.foto_cantiere','artecna_rapportini.allegati','artecna_rapportini.sessioni_portale','artecna_rapportini.richieste'])
    r[table]=(await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') v FROM ${table} t`)).rows[0].v
  return r
}

test('Letture allegati 3C: DTO, accesso, integrità, READ ONLY e ACL',async t=>{
  const db=new PGlite(),q=async(s,p=[])=>(await db.query(s,p)).rows
  const run=(n,f)=>t.test(n,f)
  const asBackend=async(fn,role='artecna_rapportini_backend')=>{
    await db.exec(`SET SESSION AUTHORIZATION ${role}`)
    try{return await fn()}finally{await db.exec('SET SESSION AUTHORIZATION postgres; RESET ROLE')}
  }
  const read=async(s,p,role)=>{
    const before=await domain(db)
    try{return await asBackend(async()=>(await q(s,p))[0].v,role)}finally{assert.deepEqual(await domain(db),before)}
  }
  const list=(rapportino=RAP,cantiere=A,data='2026-09-21',token=TOKEN,role)=>read(listSql,[token,rapportino,cantiere,data],role)
  const access=(id,token=TOKEN,role)=>read(callSql,[token,id],role)
  const seed=async(stato='finalizzato',rapportino=RAP,cantiere=A,data='2026-09-21',mime='image/jpeg')=>{
    const r=await asBackend(async()=>(await q(reserveSql,[TOKEN,rapportino,cantiere,data,randomUUID(),'ab'.repeat(32),mime,100]))[0].v)
    if(stato==='finalizzato')await asBackend(()=>q('SELECT public.finalizza_allegato_rapportino_portale($1,$2,$3)',[TOKEN,r.allegato_id,r.lease_id]))
    else if(stato!=='prenotato')await q("UPDATE artecna_rapportini.allegati SET stato=$1,lease_id=NULL,lease_until=NULL,removed_at=CASE WHEN $1 IN ('cancellato','cancellazione_pending') THEN statement_timestamp() END WHERE id=$2",[stato,r.allegato_id])
    return r
  }
  const rejected=(fn,code)=>assert.rejects(fn,e=>e.code===code)
  const fault=async(change,fn,code)=>{
    await db.exec('BEGIN')
    try{
      await db.exec(change);const before=await domain(db)
      await db.exec('SET SESSION AUTHORIZATION artecna_rapportini_backend; SAVEPOINT invocation')
      await rejected(fn,code)
      await db.exec('ROLLBACK TO SAVEPOINT invocation; SET SESSION AUTHORIZATION postgres')
      assert.deepEqual(await domain(db),before)
    }finally{await db.exec('ROLLBACK; SET SESSION AUTHORIZATION postgres')}
  }
  try{
    await setup(db);const before=await domain(db),funcs=await historical(db)
    await db.exec(sql)
    await run('migration non modifica dominio/foto/registro né sette RPC precedenti',async()=>{assert.deepEqual(await domain(db),before);assert.deepEqual(await historical(db),funcs)})
    await run('elenco senza allegati',async()=>{assert.deepEqual(await list(),{versione_contratto:1,rapportino_id:RAP,allegati:[]})})
    const one=await seed()
    await run('singolo finalizzato e DTO pubblico esatto',async()=>{
      const result=await list();assert.deepEqual(Object.keys(result).sort(),['allegati','rapportino_id','versione_contratto'])
      assert.deepEqual(result.allegati,[{allegato_id:one.allegato_id,chiave_client_allegato:one.file_path.split('/').at(-1).slice(0,-4),stato:'finalizzato',mime_type:'image/jpeg',byte_size:100}])
      assert.doesNotMatch(JSON.stringify(result),/bucket|file_path|sha256|lease|expires_at|created_at|sessione|token|credenziali/)
    })
    const two=await seed('finalizzato',RAP,A,'2026-09-21','image/png'),three=await seed('finalizzato',RAP,A,'2026-09-21','image/webp')
    await run('più finalizzati ordinati per created_at e id con tie-break stabile',async()=>{
      await q("UPDATE artecna_rapportini.allegati SET created_at='2026-01-01' WHERE id=ANY($1::uuid[])",[[two.allegato_id,three.allegato_id]])
      const expected=[two.allegato_id,three.allegato_id].sort().concat(one.allegato_id)
      assert.deepEqual((await list()).allegati.map(a=>a.allegato_id),expected)
      assert.deepEqual((await list()).allegati.map(a=>a.allegato_id),expected)
    })
    const hidden=[]
    for(const stato of ['prenotato','scaduto','cancellato','cancellazione_pending']){
      const r=await seed(stato);hidden.push(r)
      await run(`${stato} escluso dall'elenco e accesso PR409`,async()=>{
        assert.equal((await list()).allegati.some(a=>a.allegato_id===r.allegato_id),false)
        await rejected(()=>access(r.allegato_id),'PR409')
      })
    }
    await run('allegati altro Rapportino esclusi, cantiere aperto senza assegnazioni accessibile',async()=>{
      await db.exec('BEGIN')
      try{
        const other=randomUUID();await q('UPDATE public.cantieri SET lavori_conclusi=false WHERE id=$1',[B])
        await q('INSERT INTO public.rapportini(id,cantiere_id,data,versione_prestazioni) VALUES($1,$2,$3,1)',[other,B,'2026-10-04'])
        const r=await seed('finalizzato',other,B,'2026-10-04')
        assert.equal((await list()).allegati.some(a=>a.allegato_id===r.allegato_id),false)
        assert.equal((await list(other,B,'2026-10-04')).allegati.length,1)
        assert.equal((await access(r.allegato_id)).allegato_id,r.allegato_id)
      }finally{await db.exec('ROLLBACK')}
    })
    await run('accesso server esatto, bucket/path validi, nessun segreto/URL/lease',async()=>{
      assert.deepEqual(await access(one.allegato_id),{versione_contratto:1,allegato_id:one.allegato_id,
        bucket:'rapportini-v1',file_path:one.file_path,mime_type:'image/jpeg',byte_size:100})
    })
    await run('accesso allegato inesistente PR409',()=>rejected(()=>access(randomUUID()),'PR409'))
    await run('input NULL/Infinity rifiutati',async()=>{await rejected(()=>list(null),'22023');await rejected(()=>list(RAP,A,'infinity'),'22023');await rejected(()=>access(null),'22023')})
    for(const [label,token]of [['assente',null],['invalida','bad'],['sconosciuta','cd'.repeat(32)]])await run(`entrambe sessione ${label}`,async()=>{
      await rejected(()=>list(RAP,A,'2026-09-21',token),'PR401');await rejected(()=>access(one.allegato_id,token),'PR401')
    })
    for(const [label,change,code]of [
      ['sessione scaduta',"UPDATE artecna_rapportini.sessioni_portale SET created_at=statement_timestamp()-interval '2 hours',scade_at=statement_timestamp()-interval '1 hour'",'PR401'],
      ['sessione revocata','UPDATE artecna_rapportini.sessioni_portale SET revocata_at=statement_timestamp()','PR401'],
      ['compilatore sospeso',`UPDATE public.operai SET stato='sospeso' WHERE id='${OP}'`,'42501'],
      ['compilatore disabilitato',`UPDATE public.operai SET accesso_portale=false WHERE id='${OP}'`,'42501'],
      ['cantiere chiuso',`UPDATE public.cantieri SET lavori_conclusi=true WHERE id='${A}'`,'42501'],
      ['Rapportino V0',`UPDATE public.rapportini SET versione_prestazioni=0 WHERE id='${RAP}'`,'22023']
    ])await run(`entrambe ${label}`,async()=>{
      await fault(change,()=>q(listSql,[TOKEN,RAP,A,'2026-09-21']),code)
      await fault(change,()=>q(callSql,[TOKEN,one.allegato_id]),code)
    })
    await run('elenco contesto/data/UUID incoerenti',async()=>{await rejected(()=>list(RAP,A,'2026-10-04'),'PR409');await rejected(()=>list(randomUUID()),'PR409')})
    const a=(await q('SELECT * FROM artecna_rapportini.allegati WHERE id=$1',[one.allegato_id]))[0]
    for(const [label,change]of [
      ['foto mancante',`ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_foto_cantiere_id_fkey; DELETE FROM public.foto_cantiere WHERE id='${a.foto_cantiere_id}'`],
      ...[['cantiere_id',B],['rapportino_id',randomUUID()],['categoria','altro'],['data_foto','2026-10-04'],['file_url','https://invalid.example'],['file_path','preventivi/foto'],['immagine_base64','data:invalid'],['thumbnail_url','https://invalid.example'],['storage_provider','local'],['sync_status','pending']].map(([field,value])=>[field,`UPDATE public.foto_cantiere SET ${field}='${value}' WHERE id='${a.foto_cantiere_id}'`]),
      ['registro path',`UPDATE artecna_rapportini.allegati SET file_path='rapportini/incoerente.jpg' WHERE id='${a.id}'`],
      ['registro bucket',`ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_bucket; UPDATE artecna_rapportini.allegati SET bucket='preventivi' WHERE id='${a.id}'`],
      ['registro lease',`ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_lease; UPDATE artecna_rapportini.allegati SET lease_id=gen_random_uuid(),lease_until=statement_timestamp() WHERE id='${a.id}'`],
      ['registro finalized_at',`ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_coerenza; UPDATE artecna_rapportini.allegati SET finalized_at=NULL WHERE id='${a.id}'`],
      ['registro removed_at',`ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_coerenza; UPDATE artecna_rapportini.allegati SET removed_at=statement_timestamp() WHERE id='${a.id}'`]
    ])await run(`integrità ${label}: entrambe XX001, senza riparare`,async()=>{
      await fault(change,()=>q(callSql,[TOKEN,one.allegato_id]),'XX001')
      await fault(change,()=>q(listSql,[TOKEN,RAP,A,'2026-09-21']),'XX001')
    })
    await run('entrambe in BEGIN READ ONLY, snapshot intero invariato e scadenze non materializzate',async()=>{
      await q("UPDATE artecna_rapportini.allegati SET expires_at=statement_timestamp()-interval '1 second' WHERE id=$1",[hidden[0].allegato_id])
      const before=await domain(db)
      await db.exec('SET SESSION AUTHORIZATION artecna_rapportini_backend; BEGIN READ ONLY')
      try{
        assert.equal((await q(listSql,[TOKEN,RAP,A,'2026-09-21']))[0].v.allegati.length,3)
        assert.equal((await q(callSql,[TOKEN,one.allegato_id]))[0].v.allegato_id,one.allegato_id)
      }finally{await db.exec('COMMIT; SET SESSION AUTHORIZATION postgres')}
      assert.deepEqual(await domain(db),before)
      assert.equal((await q('SELECT stato FROM artecna_rapportini.allegati WHERE id=$1',[hidden[0].allegato_id]))[0].stato,'prenotato')
    })
    await run('catalogo STABLE/definer/owner/search_path, whitelist nove RPC e helper privato',async()=>{
      for(const sig of [signature,listSignature,helperSignature]){
        const [m]=await q('SELECT proowner::regrole::text owner,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid=$1::regprocedure',[sig]);assert.deepEqual(m,{owner:'postgres',prosecdef:true,provolatile:'s',proconfig:['search_path=pg_catalog, pg_temp']})
      }
      const grants=await q("SELECT p.oid::regprocedure::text signature,a.privilege_type,a.is_grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE a.grantee='artecna_rapportini_backend'::regrole")
      assert.deepEqual(grants.map(g=>g.signature).sort(),whitelist.slice().sort());for(const g of grants){assert.equal(g.privilege_type,'EXECUTE');assert.equal(g.is_grantable,false)}
      for(const role of ['postgres','anon','authenticated','service_role']){await rejected(()=>list(RAP,A,'2026-09-21',TOKEN,role),'42501');await rejected(()=>access(one.allegato_id,TOKEN,role),'42501')}
      for(const role of ['anon','authenticated','service_role','artecna_rapportini_backend'])assert.equal((await q('SELECT has_function_privilege($1,$2,\'EXECUTE\') v',[role,helperSignature]))[0].v,false)
      for(const table of ['artecna_rapportini.allegati','public.foto_cantiere','public.rapportini','public.rapportino_prestazioni','public.timbrature','public.operai']){
        assert.equal((await q("SELECT has_table_privilege('artecna_rapportini_backend',$1,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') v",[table]))[0].v,false)
        assert.equal((await q("SELECT has_any_column_privilege('artecna_rapportini_backend',$1,'SELECT,INSERT,UPDATE,REFERENCES') v",[table]))[0].v,false)
      }
      assert.equal((await q("SELECT has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE') v"))[0].v,false)
      assert.deepEqual(await historical(db),funcs)
    })
    await run('corpi RPC/helper senza DML, lock o Storage',()=>{
      const bodies=[...sql.matchAll(/AS \$fn\$([\s\S]*?)\$fn\$;/g)].map(m=>m[1]);assert.equal(bodies.length,3)
      for(const body of bodies)assert.doesNotMatch(body,/\b(?:INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|FOR\s+(?:UPDATE|SHARE)|LOCK\s+TABLE)\b|storage\.(objects|buckets)/i)
    })
    const start=sql.indexOf('DO $postcheck$'),install=sql.slice(0,start).replace(/^BEGIN;$/m,''),postcheck=sql.slice(start).replace(/^COMMIT;$/m,'')
    for(const [label,change]of [
      ['PUBLIC',`GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC`],
      ['helper backend',`GRANT EXECUTE ON FUNCTION ${helperSignature} TO artecna_rapportini_backend`],
      ['VOLATILE',`ALTER FUNCTION ${listSignature} VOLATILE`],
      ['grant delegabile',`GRANT EXECUTE ON FUNCTION ${signature} TO artecna_rapportini_backend WITH GRANT OPTION`],
      ['table backend','GRANT SELECT ON public.foto_cantiere TO artecna_rapportini_backend'],
      ['3B alterata','ALTER FUNCTION public.finalizza_allegato_rapportino_portale(text,uuid,uuid) STABLE']
    ])await run(`post-check ${label}: errore e rollback`,async()=>{
      const old=(await q('SELECT $1::regprocedure::oid oid',[signature]))[0].oid
      await db.exec(`BEGIN; DROP FUNCTION ${signature}; DROP FUNCTION ${listSignature}; DROP FUNCTION ${helperSignature}`)
      try{await db.exec(install);await db.exec(change);await rejected(()=>db.exec(postcheck),'P0001');await rejected(()=>q('SELECT 1'),'25P02')}
      finally{await db.exec('ROLLBACK')}
      assert.equal((await q('SELECT $1::regprocedure::oid oid',[signature]))[0].oid,old);assert.deepEqual(await historical(db),funcs)
    })
  }finally{await db.close()}
})
