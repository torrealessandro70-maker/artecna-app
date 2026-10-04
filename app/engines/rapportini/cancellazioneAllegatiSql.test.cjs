// Solo PostgreSQL isolati locali; nessuna credenziale di progetto o Storage.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path')
const os=require('node:os'),net=require('node:net')
const {spawnSync}=require('node:child_process')
const {Client}=require('pg')
const {randomUUID}=require('node:crypto')
const {PGlite}=require('@electric-sql/pglite')
const {fixture,A,B,RAP,OP,TOKEN}=require('./fixtureStep3.cjs')
const dir=path.resolve(__dirname,'../../../supabase/migrations')
const sql=fs.readFileSync(path.join(dir,'20261004_rapportino_allegati_cancellazione.sql'),'utf8')
const signature='public.cancella_allegato_rapportino_portale(text,uuid)'
const listSignature='public.elenca_allegati_rapportino_portale(text,uuid,uuid,date)'
const helperSignature='artecna_rapportini.accesso_allegato_finalizzato(uuid,uuid,uuid,date)'
const callSql='SELECT public.cancella_allegato_rapportino_portale($1,$2) v'
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
  'elenca_allegati_rapportino_portale(text,uuid,uuid,date)','autorizza_accesso_allegato_portale(text,uuid)','cancella_allegato_rapportino_portale(text,uuid)']
async function setup(db){
  await db.exec(fixture);await db.exec(photoSchema)
  for(const name of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql',
    '20261003_rapportino_backend_pooler.sql','20261004_rapportino_lettura_portale.sql',
    '20261004_rapportino_allegati_registro.sql','20261004_rapportino_allegati_prenotazione.sql',
    '20261004_rapportino_allegati_finalizzazione.sql','20261004_rapportino_allegati_lettura.sql'])
    await db.exec(fs.readFileSync(path.join(dir,name),'utf8'))
  await db.query("INSERT INTO artecna_rapportini.sessioni_portale(token_sha256,operaio_id,scade_at) VALUES(sha256(convert_to($1,'UTF8')),$2,statement_timestamp()+interval '8 hours')",[TOKEN,OP])
  await db.exec(`UPDATE public.rapportini SET versione_prestazioni=1 WHERE id='${RAP}'`)
}
async function historical(db){return (await db.query(`SELECT oid,pg_get_functiondef(oid) def,proowner,proacl::text FROM pg_proc
  WHERE pronamespace='artecna_rapportini'::regnamespace OR oid IN (${whitelist.slice(0,9).map(s=>`'public.${s}'::regprocedure`).join(',')}) ORDER BY oid`)).rows}
async function domain(db){
  const r={}
  for(const table of ['public.rapportini','public.rapportino_prestazioni','public.timbrature','public.foto_cantiere','artecna_rapportini.allegati','artecna_rapportini.sessioni_portale','artecna_rapportini.richieste'])
    r[table]=(await db.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') v FROM ${table} t`)).rows[0].v
  return r
}


test('Cancellazione allegati 3D: transizioni, provenienza, integrità e ACL',async t=>{
  const db=new PGlite(),q=async(s,p=[])=>(await db.query(s,p)).rows
  const backend=async(fn,role='artecna_rapportini_backend')=>{await db.exec(`SET SESSION AUTHORIZATION ${role}`);try{return await fn()}finally{await db.exec('SET SESSION AUTHORIZATION postgres; RESET ROLE')}}
  const call=(id,token=TOKEN,role)=>backend(async()=>(await q(callSql,[token,id]))[0].v,role)
  const record=async(id)=>(await q('SELECT to_jsonb(a) v FROM artecna_rapportini.allegati a WHERE id=$1',[id]))[0].v
  const seed=async(state='prenotato',rapportino=RAP,cantiere=A,data='2026-09-21')=>{
    const r=await backend(async()=>(await q(reserveSql,[TOKEN,rapportino,cantiere,data,randomUUID(),'ab'.repeat(32),'image/jpeg',100]))[0].v)
    if(state==='finalizzato')await backend(()=>q('SELECT public.finalizza_allegato_rapportino_portale($1,$2,$3)',[TOKEN,r.allegato_id,r.lease_id]))
    else if(state==='scaduto')await q("UPDATE artecna_rapportini.allegati SET stato='scaduto',lease_id=NULL,lease_until=NULL WHERE id=$1",[r.allegato_id])
    return r.allegato_id
  }
  const rejected=(fn,code)=>assert.rejects(fn,e=>e.code===code)
  const fault=async(change,id,code='XX001')=>{
    await db.exec('BEGIN')
    try{
      await db.exec(change);const before=await domain(db)
      await db.exec('SET SESSION AUTHORIZATION artecna_rapportini_backend; SAVEPOINT invocation')
      await rejected(()=>q(callSql,[TOKEN,id]),code)
      await db.exec('ROLLBACK TO SAVEPOINT invocation; SET SESSION AUTHORIZATION postgres')
      assert.deepEqual(await domain(db),before)
    }finally{await db.exec('ROLLBACK; SET SESSION AUTHORIZATION postgres')}
  }
  try{
    await setup(db);const funcs=await historical(db),initial=await domain(db);await db.exec(sql)
    await t.test('installazione solo nuova RPC: dominio e nove RPC/helper storici invariati',async()=>{assert.deepEqual(await historical(db),funcs);assert.deepEqual(await domain(db),initial)})
    // Trigger fixture: dimostra nessun UPDATE nei retry, anche se a valori identici.
    await db.exec(`CREATE TABLE public.test_updates(id uuid); CREATE FUNCTION public.test_count_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO public.test_updates VALUES(NEW.id); RETURN NEW; END $$; CREATE TRIGGER test_count AFTER UPDATE ON artecna_rapportini.allegati FOR EACH ROW EXECUTE FUNCTION public.test_count_update()`)
    let finalized
    for(const state of ['prenotato','scaduto','finalizzato'])await t.test(`${state} -> pending, identità e dominio preservati`,async()=>{
      const id=await seed(state),before=await domain(db),old=await record(id)
      const result=await call(id),stored=await record(id),after=await domain(db)
      assert.deepEqual(result,{versione_contratto:1,esito:'successo',allegato_id:id,stato:'cancellazione_pending',foto_cantiere_id:old.foto_cantiere_id,removed_at:stored.removed_at})
      assert.notEqual(stored.removed_at,null);assert.equal(stored.lease_id,null);assert.equal(stored.lease_until,null)
      for(const key of Object.keys(old).filter(k=>!['stato','removed_at','lease_id','lease_until'].includes(k)))assert.deepEqual(stored[key],old[key],key)
      assert.deepEqual(after['artecna_rapportini.allegati'].filter(a=>a.id!==id),before['artecna_rapportini.allegati'].filter(a=>a.id!==id));delete before['artecna_rapportini.allegati'];delete after['artecna_rapportini.allegati'];assert.deepEqual(after,before)
      const updates=(await q('SELECT count(*)::integer n FROM public.test_updates WHERE id=$1',[id]))[0].n
      assert.deepEqual(await call(id),result);assert.deepEqual(await record(id),stored)
      assert.equal((await q('SELECT count(*)::integer n FROM public.test_updates WHERE id=$1',[id]))[0].n,updates)
      assert.deepEqual((await backend(()=>q(listSql,[TOKEN,RAP,A,'2026-09-21'])))[0].v.allegati,[])
      await rejected(()=>backend(()=>q('SELECT public.autorizza_accesso_allegato_portale($1,$2)',[TOKEN,id])),'PR409')
      if(state==='finalizzato')finalized=id
    })
    for(const source of ['prenotato','finalizzato'])await t.test(`cancellato già esistente da ${source}: tombstone senza UPDATE`,async()=>{
      const id=await seed(source);await call(id);await q("UPDATE artecna_rapportini.allegati SET stato='cancellato' WHERE id=$1",[id])
      const before=await domain(db),n=(await q('SELECT count(*)::integer n FROM public.test_updates WHERE id=$1',[id]))[0].n
      const r=await call(id);assert.equal(r.stato,'cancellato');assert.deepEqual(await call(id),r);assert.deepEqual(await domain(db),before)
      assert.equal((await q('SELECT count(*)::integer n FROM public.test_updates WHERE id=$1',[id]))[0].n,n)
    })
    for(const [label,change]of [['finalized senza foto','foto_cantiere_id=NULL'],['foto senza finalized','finalized_at=NULL'],['lease','lease_id=gen_random_uuid(),lease_until=statement_timestamp()'],['removed assente','removed_at=NULL']])await t.test(`cancellato incoerente ${label}: XX001`,async()=>{
      await fault(`ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_coerenza; ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_lease; UPDATE artecna_rapportini.allegati SET stato='cancellato',${change} WHERE id='${finalized}'`,finalized)
    })
    const pre=await seed(),expired=await seed('scaduto'),fin=await seed('finalizzato')
    for(const [label,id,change] of [
      ['prenotato finalized',pre,'finalized_at=statement_timestamp()'],['prenotato foto',pre,`foto_cantiere_id=(SELECT foto_cantiere_id FROM artecna_rapportini.allegati WHERE id='${fin}')`],['prenotato removed',pre,'removed_at=statement_timestamp()'],
      ['scaduto finalized',expired,'finalized_at=statement_timestamp()'],['scaduto foto',expired,`foto_cantiere_id=(SELECT foto_cantiere_id FROM artecna_rapportini.allegati WHERE id='${fin}')`],['scaduto removed',expired,'removed_at=statement_timestamp()'],['scaduto lease',expired,'lease_id=gen_random_uuid(),lease_until=statement_timestamp()'],
      ['finalizzato senza finalized',fin,'finalized_at=NULL'],['finalizzato senza foto',fin,'foto_cantiere_id=NULL'],['finalizzato removed',fin,'removed_at=statement_timestamp()'],['finalizzato lease',fin,'lease_id=gen_random_uuid(),lease_until=statement_timestamp()'],
      ['pending finalized senza foto',finalized,'foto_cantiere_id=NULL'],['pending foto senza finalized',finalized,'finalized_at=NULL'],['pending senza removed',finalized,'removed_at=NULL'],['pending lease',finalized,'lease_id=gen_random_uuid(),lease_until=statement_timestamp()'],
      ['prenotato lease parziale',pre,'lease_until=NULL'],['stato impossibile',pre,"stato='impossibile'"]
    ])await t.test(`${label}: XX001 senza riparazione`,()=>fault(`ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_coerenza; ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_lease; ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_stato; ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_foto; UPDATE artecna_rapportini.allegati SET ${change} WHERE id='${id}'`,id))
    const photo=(await record(fin)).foto_cantiere_id,pendingPhoto=(await record(finalized)).foto_cantiere_id
    for(const [field,value]of [['cantiere_id',B],['rapportino_id',randomUUID()],['cantiere','errato'],['categoria','altro'],['data_foto','2026-10-04'],['nota','errata'],['file_url','url'],['file_path','path'],['immagine_base64','data:bad'],['thumbnail_url','url'],['storage_provider','local'],['sync_status','pending']])await t.test(`proiezione ${field} incoerente finalizzato/pending: XX001`,async()=>{
      for(const [id,p]of [[fin,photo],[finalized,pendingPhoto]])await fault(`UPDATE public.foto_cantiere SET ${field}='${value}' WHERE id='${p}'`,id)
    })
    await t.test('foto mancante: XX001, nessuna ricreazione',()=>fault(`ALTER TABLE artecna_rapportini.allegati DROP CONSTRAINT allegati_foto_cantiere_id_fkey; DELETE FROM public.foto_cantiere WHERE id='${photo}'`,fin))
    for(const [label,change,code]of [
      ['scadenza sessione',"UPDATE artecna_rapportini.sessioni_portale SET created_at=statement_timestamp()-interval '2 hours',scade_at=statement_timestamp()-interval '1 hour'",'PR401'],['revoca sessione','UPDATE artecna_rapportini.sessioni_portale SET revocata_at=statement_timestamp()','PR401'],
      ['sospeso',`UPDATE public.operai SET stato='sospeso' WHERE id='${OP}'`,'42501'],['disabilitato',`UPDATE public.operai SET accesso_portale=false WHERE id='${OP}'`,'42501'],['cantiere chiuso',`UPDATE public.cantieri SET lavori_conclusi=true WHERE id='${A}'`,'42501'],['V0',`UPDATE public.rapportini SET versione_prestazioni=0 WHERE id='${RAP}'`,'22023'],['contesto',`UPDATE public.cantieri SET lavori_conclusi=false WHERE id='${B}'; UPDATE artecna_rapportini.allegati SET cantiere_id='${B}' WHERE id='${pre}'`,'PR409']
    ])await t.test(`autorizzazione ${label}`,()=>fault(change,pre,code))
    await t.test('sessione assente/invalida/sconosciuta, input e UUID inesistente',async()=>{
      for(const token of [null,'bad','cd'.repeat(32)])await rejected(()=>call(pre,token),'PR401')
      await rejected(()=>call(null),'22023');await rejected(()=>call(randomUUID()),'PR409')
    })
    await t.test('qualsiasi cantiere aperto senza assegnazione: stessa semantica portale',async()=>{
      const other=randomUUID();await q('UPDATE public.cantieri SET lavori_conclusi=false WHERE id=$1',[B]);await q('INSERT INTO public.rapportini(id,cantiere_id,data,versione_prestazioni) VALUES($1,$2,$3,1)',[other,B,'2026-10-04'])
      assert.equal((await q('SELECT count(*)::integer n FROM public.utenti_cantiere WHERE cantiere_id=$1',[B]))[0].n,0)
      assert.equal((await call(await seed('finalizzato',other,B,'2026-10-04'))).stato,'cancellazione_pending')
    })
    await t.test('ACL: VOLATILE/definer/postgres/search_path, dieci RPC, nessun privilegio diretto',async()=>{
      const [m]=await q('SELECT proowner::regrole::text owner,prosecdef,provolatile,proconfig FROM pg_proc WHERE oid=$1::regprocedure',[signature]);assert.deepEqual(m,{owner:'postgres',prosecdef:true,provolatile:'v',proconfig:['search_path=pg_catalog, pg_temp']})
      const grants=await q("SELECT p.oid::regprocedure::text signature,a.privilege_type,a.is_grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE a.grantee='artecna_rapportini_backend'::regrole")
      assert.deepEqual(grants.map(g=>g.signature).sort(),whitelist.slice().sort());for(const g of grants){assert.equal(g.privilege_type,'EXECUTE');assert.equal(g.is_grantable,false)}
      for(const role of ['postgres','anon','authenticated','service_role'])await rejected(()=>call(pre,TOKEN,role),'42501')
      assert.deepEqual(await q("SELECT oid FROM pg_proc WHERE pronamespace='artecna_rapportini'::regnamespace AND has_function_privilege('artecna_rapportini_backend',oid,'EXECUTE')"),[])
      for(const table of Object.keys(await domain(db)))assert.equal((await q("SELECT has_table_privilege('artecna_rapportini_backend',$1,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege('artecna_rapportini_backend',$1,'SELECT,INSERT,UPDATE,REFERENCES') v",[table]))[0].v,false)
      assert.equal((await q("SELECT has_schema_privilege('artecna_rapportini_backend','artecna_rapportini','USAGE,CREATE') v"))[0].v,false)
      assert.deepEqual(await historical(db),funcs)
    })
    await t.test('nessuna DELETE/Storage/modifica proiezione; lock nell’ordine Rapportino Allegato foto',()=>{
      const body=sql.match(/AS \$fn\$([\s\S]*?)\$fn\$;/)[1]
      assert.doesNotMatch(body,/\bDELETE\b|\bINSERT\s+INTO\b|storage\.(objects|buckets)|UPDATE\s+public\./i)
      assert.equal((body.match(/UPDATE artecna_rapportini.allegati/g)||[]).length,1)
      assert(body.indexOf('FROM public.rapportini')<body.indexOf('SELECT * INTO a'))
      assert(body.indexOf('SELECT * INTO a')<body.indexOf('SELECT * INTO f'))
      assert.doesNotMatch(body,/SET stato='cancellato'/)
    })
    const start=sql.indexOf('DO $postcheck$'),install=sql.slice(0,start).replace(/^BEGIN;$/m,''),post=sql.slice(start).replace(/^COMMIT;$/m,'')
    for(const [label,change]of [['PUBLIC',`GRANT EXECUTE ON FUNCTION ${signature} TO PUBLIC`],['grantable',`GRANT EXECUTE ON FUNCTION ${signature} TO artecna_rapportini_backend WITH GRANT OPTION`],['STABLE',`ALTER FUNCTION ${signature} STABLE`],['owner',`ALTER FUNCTION ${signature} OWNER TO anon`],['schema','GRANT USAGE ON SCHEMA artecna_rapportini TO artecna_rapportini_backend'],['table','GRANT SELECT ON public.foto_cantiere TO artecna_rapportini_backend'],['helper',`GRANT EXECUTE ON FUNCTION ${helperSignature} TO artecna_rapportini_backend`],['3C modificata',`ALTER FUNCTION ${listSignature} VOLATILE`]])await t.test(`post-check ${label}: fallisce e rollback`,async()=>{
      const oid=(await q('SELECT $1::regprocedure::oid oid',[signature]))[0].oid;await db.exec(`BEGIN; DROP FUNCTION ${signature}`)
      try{await db.exec(install);await db.exec(change);await rejected(()=>db.exec(post),'P0001');await rejected(()=>q('SELECT 1'),'25P02')}finally{await db.exec('ROLLBACK')}
      assert.equal((await q('SELECT $1::regprocedure::oid oid',[signature]))[0].oid,oid);assert.deepEqual(await historical(db),funcs)
    })
  }finally{await db.close()}
})

test('Cancellazione concorrente reale: una transizione e stesso removed_at',async t=>{
  const bin=path.join(os.tmpdir(),'artecna-postgres-test-runtime/pgsql/bin')
  if(!fs.existsSync(path.join(bin,'initdb.exe')))throw new Error('Runtime PostgreSQL locale richiesto')
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'artecna-cancella-concorrenza-'))
  const ctl=(exe,args)=>{const r=spawnSync(path.join(bin,exe),args,{stdio:'ignore',windowsHide:true,timeout:30000});if(r.status!==0)throw new Error('Runtime PostgreSQL locale non disponibile')}
  const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})})
  const clients=[];let started=false
  const connect=async(user='postgres')=>{const c=new Client({host:'127.0.0.1',port,database:'postgres',user,connectionTimeoutMillis:5000});await c.connect();clients.push(c);return c}
  try{
    ctl('initdb.exe',['-D',scratch,'-U','postgres','--auth=trust','--encoding=UTF8','--locale=C'])
    ctl('pg_ctl.exe',['-D',scratch,'-l',path.join(scratch,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start']);started=true
    const admin=await connect(),db={exec:s=>admin.query(s),query:(s,p)=>admin.query(s,p)}
    await setup(db);const funcs=await historical(db);await db.exec(sql)
    const c1=await connect('artecna_rapportini_backend'),c2=await connect('artecna_rapportini_backend')
    const r=(await c1.query(reserveSql,[TOKEN,RAP,A,'2026-09-21',randomUUID(),'ab'.repeat(32),'image/jpeg',100])).rows[0].v
    await c1.query('SELECT public.finalizza_allegato_rapportino_portale($1,$2,$3)',[TOKEN,r.allegato_id,r.lease_id]);
    const before=await domain(db),old=(await admin.query('SELECT * FROM artecna_rapportini.allegati WHERE id=$1',[r.allegato_id])).rows[0];
    await admin.query('CREATE TABLE public.test_updates(id uuid); CREATE FUNCTION public.test_count_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO public.test_updates VALUES(NEW.id); RETURN NEW; END $$; CREATE TRIGGER test_count AFTER UPDATE ON artecna_rapportini.allegati FOR EACH ROW EXECUTE FUNCTION public.test_count_update()');
    const pids=[(await c1.query('SELECT pg_backend_pid() p')).rows[0].p,(await c2.query('SELECT pg_backend_pid() p')).rows[0].p]
    await admin.query('BEGIN');await admin.query('SELECT id FROM public.rapportini WHERE id=$1 FOR UPDATE',[RAP])
    const pending=Promise.allSettled([c1.query(callSql,[TOKEN,r.allegato_id]),c2.query(callSql,[TOKEN,r.allegato_id])]);let blocked=false
    try{for(let i=0;i<100;i++){const a=await admin.query("SELECT count(*)::integer n FROM pg_stat_activity WHERE pid=ANY($1::integer[]) AND wait_event_type='Lock'",[pids]);if(a.rows[0].n===2){blocked=true;break}await new Promise(resolve=>setTimeout(resolve,20))}}
    finally{await admin.query('COMMIT')}
    const results=await pending
    await t.test('entrambe sovrapposte, una transizione, stesso removed_at e nessun deadlock',async()=>{
      assert.equal(blocked,true);assert.equal(results.every(r=>r.status==='fulfilled'),true)
      const a=results[0].value.rows[0].v,b=results[1].value.rows[0].v;assert.deepEqual(a,b);assert.equal(a.esito,'successo')
      assert.equal((await admin.query('SELECT count(*)::integer n FROM public.foto_cantiere')).rows[0].n,1)
      const stored=(await admin.query('SELECT * FROM artecna_rapportini.allegati')).rows[0];assert.equal(stored.stato,'cancellazione_pending');assert.equal(stored.removed_at.getTime(),new Date(a.removed_at).getTime());assert.equal(stored.foto_cantiere_id,old.foto_cantiere_id);assert.equal(stored.finalized_at.toISOString(),old.finalized_at.toISOString());
      assert.equal((await admin.query('SELECT count(*)::integer n FROM public.test_updates')).rows[0].n,1);assert.equal(stored.lease_id,null);assert.equal(stored.lease_until,null)
    })
    await t.test('dominio/revisioni e RPC precedenti invariati',async()=>{const after=await domain(db);delete after['artecna_rapportini.allegati'];delete before['artecna_rapportini.allegati'];assert.deepEqual(after,before);assert.deepEqual(await historical(db),funcs)})
  }finally{
    await Promise.allSettled(clients.map(c=>c.end()));if(started)ctl('pg_ctl.exe',['-D',scratch,'-m','immediate','-w','stop'])
    const resolved=path.resolve(scratch),root=path.resolve(os.tmpdir())+path.sep
    if(!resolved.startsWith(root)||!path.basename(resolved).startsWith('artecna-cancella-concorrenza-'))throw new Error('Percorso cleanup inatteso')
    fs.rmSync(resolved,{recursive:true,force:true})
  }
})
