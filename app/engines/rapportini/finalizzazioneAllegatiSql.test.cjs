// Solo PostgreSQL isolati locali; nessuna credenziale di progetto o Storage.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net')
const {spawnSync}=require('node:child_process')
const {randomUUID}=require('node:crypto')
const {PGlite}=require('@electric-sql/pglite')
const {Client}=require('pg')
const {fixture,A,B,RAP,OP,TOKEN}=require('./fixtureStep3.cjs')
const dir=path.resolve(__dirname,'../../../supabase/migrations')
const sql=fs.readFileSync(path.join(dir,'20261004_rapportino_allegati_finalizzazione.sql'),'utf8')
const signature='public.finalizza_allegato_rapportino_portale(text,uuid,uuid)'
const callSql='SELECT public.finalizza_allegato_rapportino_portale($1,$2,$3) v'
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
  'finalizza_allegato_rapportino_portale(text,uuid,uuid)']
async function setup(db){
  await db.exec(fixture);await db.exec(photoSchema)
  for(const name of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql',
    '20261003_rapportino_backend_pooler.sql','20261004_rapportino_lettura_portale.sql',
    '20261004_rapportino_allegati_registro.sql','20261004_rapportino_allegati_prenotazione.sql'])
    await db.exec(fs.readFileSync(path.join(dir,name),'utf8'))
  await db.query("INSERT INTO artecna_rapportini.sessioni_portale(token_sha256,operaio_id,scade_at) VALUES(sha256(convert_to($1,'UTF8')),$2,statement_timestamp()+interval '8 hours')",[TOKEN,OP])
  await db.exec(`UPDATE public.rapportini SET versione_prestazioni=1 WHERE id='${RAP}'`)
}
async function historical(db){return (await db.query(`SELECT oid,pg_get_functiondef(oid) def,proowner,proacl::text FROM pg_proc
  WHERE pronamespace='artecna_rapportini'::regnamespace OR oid IN (${whitelist.slice(0,6).map(s=>`'public.${s}'::regprocedure`).join(',')}) ORDER BY oid`)).rows}
async function domain(db){
  const r={}
  for(const table of ['public.rapportini','public.rapportino_prestazioni','public.timbrature','artecna_rapportini.sessioni_portale','artecna_rapportini.richieste'])
    r[table]=(await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') v FROM ${table} t`)).rows[0].v
  return r
}
test('Finalizzazione allegati: autorizzazione, proiezione, stati e atomicità',async t=>{
  const db=new PGlite(),q=async(s,p=[])=>(await db.query(s,p)).rows
  const run=(n,f)=>t.test(n,f)
  const backend=async(fn,role='artecna_rapportini_backend')=>{
    const before=await domain(db);await db.exec(`SET SESSION AUTHORIZATION ${role}`)
    try{return await fn()}finally{await db.exec('SET SESSION AUTHORIZATION postgres; RESET ROLE');assert.deepEqual(await domain(db),before)}
  }
  const reserve=()=>backend(async()=>(await q(reserveSql,[TOKEN,RAP,A,'2026-09-21',randomUUID(),'ab'.repeat(32),'image/jpeg',100]))[0].v)
  const call=(r,token=TOKEN,lease=r.lease_id,role)=>backend(async()=>(await q(callSql,[token,r.allegato_id,lease]))[0].v,role)
  const reject=(r,code,token=TOKEN,lease=r.lease_id)=>assert.rejects(()=>call(r,token,lease),e=>e.code===code)
  const record=async id=>(await q('SELECT * FROM artecna_rapportini.allegati WHERE id=$1',[id]))[0]
  const photos=async()=>q('SELECT * FROM public.foto_cantiere ORDER BY id')
  try{
    await setup(db);const before=await domain(db),funcs=await historical(db),photoBefore=await photos()
    await db.exec(sql)
    await run('migration non altera RPC precedenti, dominio o foto',async()=>{assert.deepEqual(await historical(db),funcs);assert.deepEqual(await domain(db),before);assert.deepEqual(await photos(),photoBefore)})
    await run('finalizzazione normale: proiezione esatta, UUID text, lease NULL e contratto minimo',async()=>{
      const r=await reserve(),result=await call(r),a=await record(r.allegato_id),f=(await photos())[0]
      assert.equal(result.esito,'successo');assert.equal(result.stato,'finalizzato');assert.equal(result.allegato_id,r.allegato_id)
      assert.equal(result.foto_cantiere_id,f.id);assert.ok(result.finalized_at);assert.equal(a.stato,'finalizzato');assert.equal(a.lease_id,null);assert.equal(a.lease_until,null)
      assert.equal(new Date(result.finalized_at).getTime(),a.finalized_at.getTime());assert.equal(new Date(r.expires_at).getTime(),a.expires_at.getTime())
      assert.deepEqual(Object.keys(result).sort(),'versione_contratto esito allegato_id stato foto_cantiere_id finalized_at'.split(' ').sort())
      const {id,created_at,...fields}=f;assert.ok(created_at)
      assert.deepEqual(fields,{cantiere_id:A,cantiere:'Cantiere A',rapportino_id:RAP,sopralluogo_id:null,
        categoria:'rapportino',data_foto:'2026-09-21',nota:'',file_url:null,file_path:null,immagine_base64:'',thumbnail_url:null,storage_provider:'cloud',sync_status:'not_required'})
    })
    await run('risposta persa/retry: stessa foto/finalized_at, nessun INSERT/UPDATE',async()=>{
      const r=await reserve(),result=await call(r),a=await record(r.allegato_id),p=await photos()
      await db.exec(`CREATE FUNCTION pg_temp.vieta_scrittura() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Scrittura inattesa'; END $$;
        CREATE TRIGGER test_photo BEFORE INSERT OR UPDATE ON public.foto_cantiere FOR EACH ROW EXECUTE FUNCTION pg_temp.vieta_scrittura();
        CREATE TRIGGER test_allegato BEFORE UPDATE ON artecna_rapportini.allegati FOR EACH ROW EXECUTE FUNCTION pg_temp.vieta_scrittura();`)
      try{assert.deepEqual(await call(r),result);assert.deepEqual(await record(r.allegato_id),a);assert.deepEqual(await photos(),p)}
      finally{await db.exec('DROP TRIGGER test_photo ON public.foto_cantiere; DROP TRIGGER test_allegato ON artecna_rapportini.allegati; DROP FUNCTION pg_temp.vieta_scrittura()')}
    })
    await run('lease errata PR409 e nessuna foto',async()=>{const r=await reserve(),p=await photos();await reject(r,'PR409',TOKEN,randomUUID());assert.deepEqual(await photos(),p)})
    await run('lease scaduta PR409',async()=>{const r=await reserve();await q("UPDATE artecna_rapportini.allegati SET lease_until=statement_timestamp()-interval '1 second' WHERE id=$1",[r.allegato_id]);await reject(r,'PR409')})
    await run('expires_at trascorsa: scaduto COMMIT, lease NULL, nessuna foto',async()=>{
      const r=await reserve(),p=await photos();await q("UPDATE artecna_rapportini.allegati SET expires_at=statement_timestamp()-interval '1 second' WHERE id=$1",[r.allegato_id])
      assert.deepEqual(await call(r),{versione_contratto:1,esito:'scaduto_persistito_con_conflitto',allegato_id:r.allegato_id,stato:'scaduto',foto_cantiere_id:null,finalized_at:null})
      const a=await record(r.allegato_id);assert.equal(a.stato,'scaduto');assert.equal(a.lease_id,null);assert.equal(a.lease_until,null);assert.deepEqual(await photos(),p);await reject(r,'PR409')
    })
    for(const stato of ['scaduto','cancellazione_pending','cancellato'])await run(`${stato}: conflitto senza riparazione`,async()=>{
      const r=await reserve();await q("UPDATE artecna_rapportini.allegati SET stato=$1,lease_id=NULL,lease_until=NULL,removed_at=CASE WHEN $1 IN ('cancellato','cancellazione_pending') THEN statement_timestamp() END WHERE id=$2",[stato,r.allegato_id])
      const a=await record(r.allegato_id),p=await photos();await reject(r,'PR409');assert.deepEqual(await record(r.allegato_id),a);assert.deepEqual(await photos(),p)
    })
    await run('proiezione mancante: XX001, non ricreata',async()=>{
      const r=await reserve(),result=await call(r)
      await db.exec('BEGIN')
      try{
        await db.exec('ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_foto_cantiere_id_fkey')
        await q('DELETE FROM public.foto_cantiere WHERE id=$1',[result.foto_cantiere_id]);const p=await photos()
        await db.exec('SET SESSION AUTHORIZATION artecna_rapportini_backend; SAVEPOINT invocation')
        await assert.rejects(()=>q(callSql,[TOKEN,r.allegato_id,r.lease_id]),e=>e.code==='XX001' && e.message==='Proiezione allegato non valida')
        await db.exec('ROLLBACK TO SAVEPOINT invocation; SET SESSION AUTHORIZATION postgres');assert.deepEqual(await photos(),p)
      }finally{await db.exec('ROLLBACK; SET SESSION AUTHORIZATION postgres')}
    })
    for(const [field,value]of [['rapportino_id',randomUUID()],['cantiere_id',B],['categoria','altro'],['file_path','preventivi/foto.jpg'],['file_url','https://invalid.example'],['data_foto','2026-10-04']])await run(`proiezione ${field} incoerente: XX001`,async()=>{
      const r=await reserve(),result=await call(r);await q(`UPDATE public.foto_cantiere SET ${field}=$1 WHERE id=$2`,[value,result.foto_cantiere_id]);const p=await photos();await reject(r,'XX001');assert.deepEqual(await photos(),p)
    })
    await db.exec('DELETE FROM artecna_rapportini.allegati')
    await run('UPDATE allegato fallisce: rollback elimina INSERT foto',async()=>{
      const r=await reserve(),p=await photos(),a=await record(r.allegato_id)
      await db.exec(`CREATE FUNCTION pg_temp.fallisce_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Errore controllato test'; END $$;
        CREATE TRIGGER test_failure BEFORE UPDATE ON artecna_rapportini.allegati FOR EACH ROW EXECUTE FUNCTION pg_temp.fallisce_update();`)
      try{await reject(r,'XX001');assert.deepEqual(await photos(),p);assert.deepEqual(await record(r.allegato_id),a)}
      finally{await db.exec('DROP TRIGGER test_failure ON artecna_rapportini.allegati; DROP FUNCTION pg_temp.fallisce_update()')}
    })
    for(const [label,token]of [['assente',null],['invalida','bad'],['sconosciuta','cd'.repeat(32)]])await run(`sessione ${label}`,async()=>{await reject(await reserve(),'PR401',token)})
    for(const [label,change]of [['scaduta',"created_at=statement_timestamp()-interval '2 hours',scade_at=statement_timestamp()-interval '1 hour'"],['revocata','revocata_at=statement_timestamp()']])await run(`sessione ${label}`,async()=>{
      const r=await reserve();await db.exec('BEGIN')
      try{await db.exec(`UPDATE artecna_rapportini.sessioni_portale SET ${change}; SET SESSION AUTHORIZATION artecna_rapportini_backend; SAVEPOINT invocation`);await assert.rejects(()=>q(callSql,[TOKEN,r.allegato_id,r.lease_id]),e=>e.code==='PR401')}
      finally{await db.exec('ROLLBACK; SET SESSION AUTHORIZATION postgres')}
    })
    await run('compilatore sospeso',async()=>{const r=await reserve();await db.exec(`UPDATE public.operai SET stato='sospeso' WHERE id='${OP}'`);try{await reject(r,'42501')}finally{await db.exec(`UPDATE public.operai SET stato='attivo' WHERE id='${OP}'`)}})
    await run('cantiere chiuso',async()=>{const r=await reserve();await db.exec(`UPDATE public.cantieri SET lavori_conclusi=true WHERE id='${A}'`);try{await reject(r,'42501')}finally{await db.exec(`UPDATE public.cantieri SET lavori_conclusi=false WHERE id='${A}'`)}})
    await run('Rapportino V0',async()=>{const r=await reserve();await db.exec(`UPDATE public.rapportini SET versione_prestazioni=0 WHERE id='${RAP}'`);try{await reject(r,'22023')}finally{await db.exec(`UPDATE public.rapportini SET versione_prestazioni=1 WHERE id='${RAP}'`)}})
    await run('contesto incoerente',async()=>{const r=await reserve();await q('UPDATE artecna_rapportini.allegati SET cantiere_id=$1 WHERE id=$2',[B,r.allegato_id]);await db.exec(`UPDATE public.cantieri SET lavori_conclusi=false WHERE id='${B}'`);try{await reject(r,'PR409')}finally{await db.exec(`UPDATE public.cantieri SET lavori_conclusi=true WHERE id='${B}'`)}})
    await run('input NULL',async()=>{await reject({allegato_id:null,lease_id:randomUUID()},'22023');await reject(await reserve(),'22023',TOKEN,null)})
    await run('allegato inesistente',()=>reject({allegato_id:randomUUID(),lease_id:randomUUID()},'PR409'))
    await run('metadati/ACL/whitelist sette RPC',async()=>{
      const [m]=await q('SELECT proowner::regrole::text owner,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid=$1::regprocedure',[signature]);assert.deepEqual(m,{owner:'postgres',prosecdef:true,provolatile:'v',proconfig:['search_path=pg_catalog, pg_temp']})
      const acl=await q("SELECT p.oid::regprocedure::text signature,a.privilege_type,a.is_grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE a.grantee='artecna_rapportini_backend'::regrole");assert.deepEqual(acl.map(a=>a.signature).sort(),whitelist.slice().sort());for(const a of acl){assert.equal(a.is_grantable,false);assert.equal(a.privilege_type,'EXECUTE')}
      const r=await reserve();for(const role of ['postgres','anon','authenticated','service_role'])await assert.rejects(()=>call(r,TOKEN,r.lease_id,role),e=>e.code==='42501')
      for(const table of ['artecna_rapportini.allegati','public.foto_cantiere']){assert.equal((await q("SELECT has_table_privilege('artecna_rapportini_backend',$1,'SELECT,INSERT,UPDATE,DELETE') v",[table]))[0].v,false);assert.equal((await q("SELECT has_any_column_privilege('artecna_rapportini_backend',$1,'SELECT,INSERT,UPDATE,REFERENCES') v",[table]))[0].v,false)}
      assert.equal((await q("SELECT has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE') v"))[0].v,false)
      assert.deepEqual(await q("SELECT oid FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace AND has_function_privilege('artecna_rapportini_backend',oid,'EXECUTE')"),[])
    })
    await run('nessuna operazione Storage o ALTER proiezione; dominio invariato',async()=>{assert.doesNotMatch(sql,/storage\.(objects|buckets)|ALTER\s+TABLE\s+public\.foto_cantiere|allegato_rapportino_v1_id/i);assert.deepEqual(await historical(db),funcs)})
    await run('compilatore disabilitato',async()=>{const r=await reserve();await db.exec(`UPDATE public.operai SET accesso_portale=false WHERE id='${OP}'`);try{await reject(r,'42501')}finally{await db.exec(`UPDATE public.operai SET accesso_portale=true WHERE id='${OP}'`)}})
    await run('data_foto DATE compatibile: INSERT e retry canonici',async()=>{
      const r=await reserve();await db.exec('BEGIN')
      try{
        await db.exec('ALTER TABLE public.foto_cantiere ALTER COLUMN data_foto TYPE date USING data_foto::date')
        // Installa sulla fixture DATE, senza riusare il piano PL/pgSQL TEXT.
        await db.exec(`DROP FUNCTION ${signature}`)
        await db.exec(sql.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,''))
        await db.exec('SET SESSION AUTHORIZATION artecna_rapportini_backend; SAVEPOINT invocation')
        let result
        try{result=(await q(callSql,[TOKEN,r.allegato_id,r.lease_id]))[0].v}
        catch(e){await db.exec('ROLLBACK TO SAVEPOINT invocation');throw new Error(`DATE fixture SQLSTATE ${e.code}: ${e.message}`)}
        assert.equal(result.stato,'finalizzato');assert.deepEqual((await q(callSql,[TOKEN,r.allegato_id,r.lease_id]))[0].v,result)
        await db.exec('SET SESSION AUTHORIZATION postgres')
      }finally{await db.exec('ROLLBACK; SET SESSION AUTHORIZATION postgres')}
    })
    await run('finalizzato con lease impossibile: integrità, nessuna riparazione',async()=>{
      const r=await reserve();await call(r);await db.exec('BEGIN')
      try{
        await db.exec('ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_lease')
        await q('UPDATE artecna_rapportini.allegati SET lease_id=$1,lease_until=statement_timestamp() WHERE id=$2',[randomUUID(),r.allegato_id])
        const a=await record(r.allegato_id),p=await photos()
        await db.exec('SET SESSION AUTHORIZATION artecna_rapportini_backend; SAVEPOINT invocation')
        await assert.rejects(()=>q(callSql,[TOKEN,r.allegato_id,r.lease_id]),e=>e.code==='XX001'&&e.message==='Stato allegato non valido')
        await db.exec('ROLLBACK TO SAVEPOINT invocation; SET SESSION AUTHORIZATION postgres');assert.deepEqual(await record(r.allegato_id),a);assert.deepEqual(await photos(),p)
      }finally{await db.exec('ROLLBACK; SET SESSION AUTHORIZATION postgres')}
    })
    const postStart=sql.indexOf('DO $postcheck$'),install=sql.slice(0,postStart).replace(/^BEGIN;$/m,''),postcheck=sql.slice(postStart).replace(/^COMMIT;$/m,'')
    for(const [label,fault]of [
      ['SECURITY INVOKER',`ALTER FUNCTION ${signature} SECURITY INVOKER`],
      ['PUBLIC',`GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC`],
      ['grantable',`GRANT EXECUTE ON FUNCTION ${signature} TO artecna_rapportini_backend WITH GRANT OPTION`],
      ['foto accessibili','GRANT SELECT ON public.foto_cantiere TO artecna_rapportini_backend'],
      ['registro accessibile','GRANT UPDATE ON artecna_rapportini.allegati TO artecna_rapportini_backend'],
      ['helper accessibile','GRANT EXECUTE ON FUNCTION artecna_rapportini.autorizza_lettura_portale(text,uuid) TO artecna_rapportini_backend'],
      ['3A alterata','ALTER FUNCTION public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint) STABLE']
    ])await run(`post-check ${label}: fallisce e rollback`,async()=>{
      const old=(await q('SELECT $1::regprocedure::oid oid',[signature]))[0].oid
      await db.exec(`BEGIN; DROP FUNCTION ${signature}`)
      try{await db.exec(install);await db.exec(fault);await assert.rejects(()=>db.exec(postcheck),e=>e.code==='P0001');await assert.rejects(()=>q('SELECT 1'),e=>e.code==='25P02')}
      finally{await db.exec('ROLLBACK')}
      assert.equal((await q('SELECT $1::regprocedure::oid oid',[signature]))[0].oid,old);assert.deepEqual(await historical(db),funcs)
    })
    await run('preflight schema foto incompatibile: rollback senza alterazioni persistenti',async()=>{
      const old=(await q('SELECT $1::regprocedure::oid oid',[signature]))[0].oid
      await db.exec(`BEGIN; DROP FUNCTION ${signature}; ALTER TABLE public.foto_cantiere DROP COLUMN thumbnail_url`)
      try{await assert.rejects(()=>db.exec(sql.replace(/^BEGIN;$/m,'')),e=>e.code==='P0001'&&e.message==='Schema foto incompatibile: thumbnail_url')}
      finally{await db.exec('ROLLBACK')}
      assert.equal((await q('SELECT $1::regprocedure::oid oid',[signature]))[0].oid,old)
    })
    await run('modello PIN: secondo cantiere aperto senza associazione, stessa autorizzazione STEP 3/lettura/3A/3B',async()=>{
      const other=randomUUID()
      await db.exec('BEGIN')
      try{
        await q('UPDATE public.cantieri SET lavori_conclusi=false WHERE id=$1',[B])
        await q('INSERT INTO public.rapportini(id,cantiere_id,data,versione_prestazioni) VALUES($1,$2,$3,1)',[other,B,'2026-10-04'])
        assert.equal((await q('SELECT count(*) n FROM public.utenti_cantiere WHERE cantiere_id=$1',[B]))[0].n,0)
        // Il login crea intenzionalmente una sessione, a differenza delle letture/3B.
        await db.exec('SET SESSION AUTHORIZATION artecna_rapportini_backend')
        let login
        try{login=(await q('SELECT public.crea_sessione_rapportino($1,$2) v',['1234','ef'.repeat(32)]))[0].v}
        finally{await db.exec('SET SESSION AUTHORIZATION postgres')}
        assert.deepEqual(login.cantieri.map(c=>c.id).sort(),[A,B].sort())
        for(const id of [A,B]){
          const auth=await backend(async()=>(await q('SELECT public.verifica_sessione_rapportino($1,$2) v',[TOKEN,id]))[0].v)
          assert.equal(auth.id,OP)
        }
        const read=await backend(async()=>(await q('SELECT public.leggi_rapportino_portale($1,$2,$3,$4) v',[TOKEN,B,'2026-10-04',other]))[0].v)
        assert.equal(read.rapportino_id,other)
        const reserved=await backend(async()=>(await q(reserveSql,[TOKEN,other,B,'2026-10-04',randomUUID(),'ab'.repeat(32),'image/jpeg',100]))[0].v)
        const result=await call(reserved)
        assert.equal(result.esito,'successo')
        const photo=(await q('SELECT cantiere_id,rapportino_id FROM public.foto_cantiere WHERE id=$1',[result.foto_cantiere_id]))[0]
        assert.deepEqual(photo,{cantiere_id:B,rapportino_id:other})
      }finally{await db.exec('ROLLBACK; SET SESSION AUTHORIZATION postgres')}
    })
  }finally{await db.close()}
})

test('Finalizzazione concorrente reale: unica proiezione e retry convergente',async t=>{
  const bin=path.join(os.tmpdir(),'artecna-postgres-test-runtime/pgsql/bin')
  if(!fs.existsSync(path.join(bin,'initdb.exe')))throw new Error('Runtime PostgreSQL locale richiesto')
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'artecna-finalizza-concorrenza-'))
  const ctl=(exe,args)=>{const r=spawnSync(path.join(bin,exe),args,{stdio:'ignore',windowsHide:true,timeout:30000});if(r.status!==0)throw new Error('Runtime PostgreSQL locale non disponibile')}
  const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})})
  const clients=[];let started=false
  const connect=async(user='postgres')=>{const c=new Client({host:'127.0.0.1',port,database:'postgres',user,connectionTimeoutMillis:5000});await c.connect();clients.push(c);return c}
  try{
    ctl('initdb.exe',['-D',scratch,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C'])
    ctl('pg_ctl.exe',['-D',scratch,'-l',path.join(scratch,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start']);started=true
    const admin=await connect(),db={exec:s=>admin.query(s),query:(s,p)=>admin.query(s,p)}
    await setup(db);const before=await domain(db),funcs=await historical(db);await db.exec(sql)
    const c1=await connect('artecna_rapportini_backend'),c2=await connect('artecna_rapportini_backend')
    const r=(await c1.query(reserveSql,[TOKEN,RAP,A,'2026-09-21',randomUUID(),'ab'.repeat(32),'image/jpeg',100])).rows[0].v
    const pids=[(await c1.query('SELECT pg_backend_pid() p')).rows[0].p,(await c2.query('SELECT pg_backend_pid() p')).rows[0].p]
    await admin.query('BEGIN');await admin.query('SELECT id FROM public.rapportini WHERE id=$1 FOR UPDATE',[RAP])
    const pending=Promise.allSettled([c1.query(callSql,[TOKEN,r.allegato_id,r.lease_id]),c2.query(callSql,[TOKEN,r.allegato_id,r.lease_id])]);let blocked=false
    try{for(let i=0;i<100;i++){const a=await admin.query("SELECT count(*)::integer n FROM pg_stat_activity WHERE pid=ANY($1::integer[]) AND wait_event_type='Lock'",[pids]);if(a.rows[0].n===2){blocked=true;break}await new Promise(resolve=>setTimeout(resolve,20))}}
    finally{await admin.query('COMMIT')}
    const results=await pending
    await t.test('entrambe sovrapposte e convergenti sulla stessa foto',async()=>{
      assert.equal(blocked,true);assert.equal(results.every(r=>r.status==='fulfilled'),true)
      const a=results[0].value.rows[0].v,b=results[1].value.rows[0].v;assert.deepEqual(a,b);assert.equal(a.esito,'successo')
      assert.equal((await admin.query('SELECT count(*)::integer n FROM public.foto_cantiere')).rows[0].n,1)
      const stored=(await admin.query('SELECT * FROM artecna_rapportini.allegati')).rows[0];assert.equal(stored.foto_cantiere_id,a.foto_cantiere_id);assert.equal(stored.lease_id,null);assert.equal(stored.lease_until,null)
    })
    await t.test('dominio/revisioni e RPC precedenti invariati',async()=>{assert.deepEqual(await domain(db),before);assert.deepEqual(await historical(db),funcs)})
  }finally{
    await Promise.allSettled(clients.map(c=>c.end()));if(started)ctl('pg_ctl.exe',['-D',scratch,'-m','immediate','-w','stop'])
    const resolved=path.resolve(scratch),root=path.resolve(os.tmpdir())+path.sep
    if(!resolved.startsWith(root)||!path.basename(resolved).startsWith('artecna-finalizza-concorrenza-'))throw new Error('Percorso cleanup inatteso')
    fs.rmSync(resolved,{recursive:true,force:true})
  }
})
