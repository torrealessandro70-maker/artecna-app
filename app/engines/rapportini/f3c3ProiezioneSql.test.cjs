// Cluster PostgreSQL 17.6 temporaneo localhost; nessuna credenziale/Storage remoti.
const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net')
const {execFileSync}=require('node:child_process'),{randomUUID,createHash}=require('node:crypto'),{Client}=require('pg')
const {fixture,A,RAP,OP,TOKEN}=require('./fixtureStep3.cjs')
const production=require('./f3c3Production.fixture.json')
const dir=path.resolve(__dirname,'../../../supabase/migrations')
const read=n=>fs.readFileSync(path.join(dir,n),'utf8')
const sql=read('20261007_f3c3_foto_v1_proiezione.sql')
const reserveSql='SELECT public.prenota_allegato_rapportino_portale($1,$2,$3,$4,$5,$6,$7,$8) v'
const finalizeSql='SELECT public.finalizza_allegato_rapportino_portale($1,$2,$3) v'
const cancelSql='SELECT public.cancella_allegato_rapportino_portale($1,$2) v'
const legacy=['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql',
 '20261003_rapportino_backend_pooler.sql','20261004_rapportino_lettura_portale.sql',
 '20261004_rapportino_allegati_registro.sql','20261004_rapportino_allegati_prenotazione.sql',
 '20261004_rapportino_allegati_finalizzazione.sql','20261004_rapportino_allegati_lettura.sql',
 '20261004_rapportino_allegati_cancellazione.sql','20261004_rapportino_allegati_tombstone.sql']
const quote=s=>'"'+s.replaceAll('"','""')+'"'
const photo=production.tables['public.foto_cantiere']
const photoSql=`CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
CREATE TABLE public.foto_cantiere(${photo.columns.map(c=>quote(c.name)+' '+c.type+(c.not_null?' NOT NULL':'')+(c.default?' DEFAULT '+c.default:'')).join(',')});
${photo.constraints.map(c=>'ALTER TABLE public.foto_cantiere ADD CONSTRAINT '+quote(c.name)+' '+c.definition+';').join('\n')}
CREATE ROLE artecna_cantieri_delete_rpc NOLOGIN;
REVOKE ALL ON public.foto_cantiere FROM anon,authenticated,service_role;
GRANT ALL ON public.foto_cantiere TO anon,authenticated,service_role;
GRANT SELECT,DELETE ON public.foto_cantiere TO artecna_cantieri_delete_rpc;
GRANT UPDATE(cantiere_id) ON public.foto_cantiere TO artecna_cantieri_delete_rpc;`
async function port(){const s=net.createServer();await new Promise((r,j)=>{s.once('error',j);s.listen(0,'127.0.0.1',r)});const p=s.address().port;await new Promise(r=>s.close(r));return p}
test('F3C3: baseline Production, capability, guardie e compatibilità su PostgreSQL 17.6',async t=>{
 const candidates=[process.env.F3C3_PG_BIN,
  path.join(os.tmpdir(),'artecna-postgres17-minimal-runtime/pgsql/bin'),
  ...(process.platform==='win32'?[path.join(os.homedir(),'AppData','Local','Temp','artecna-postgres17-minimal-runtime','pgsql','bin')]:[])
 ].filter(Boolean)
 const failures=[]
 const bin=[...new Set(candidates)].find(candidate=>{
  try{
   for(const name of ['postgres','initdb','pg_ctl']){
    const executable=path.join(candidate,name+(process.platform==='win32'?'.exe':''))
    if(!fs.statSync(executable).isFile())throw Error(name+': eseguibile assente')
    const version=execFileSync(executable,['--version'],{encoding:'utf8',windowsHide:true,timeout:10000})
    if(!/\b17\.6\b/.test(version))throw Error(name+': richiesta versione 17.6, ricevuta '+version.trim())
   }
   return true
  }catch(error){failures.push(candidate+': '+error.message);return false}
 })
 if(!bin)throw Error('Runtime PostgreSQL 17.6 non disponibile. Percorsi verificati:\n'+failures.join('\n'))
 t.diagnostic('Runtime PostgreSQL 17.6: '+bin)
 const exe=n=>path.join(bin,n+(process.platform==='win32'?'.exe':''))
 assert.match(execFileSync(exe('postgres'),['--version'],{encoding:'utf8',windowsHide:true}),/17\.6/)
 const clusterParent=process.platform==='win32'?path.join(os.homedir(),'AppData','Local','Temp'):os.tmpdir()
 const root=fs.mkdtempSync(path.join(clusterParent,'artecna-f3c3-')),data=path.join(root,'data'),p=await port()
 const ctl=(n,args)=>{
  // pg_ctl conserva stream chiusi: il server Windows può ereditare le pipe.
  if(n!=='initdb')return execFileSync(exe(n),args,{stdio:'ignore',windowsHide:true,timeout:60000})
  try{
   const stdout=execFileSync(exe(n),args,{stdio:['ignore','pipe','pipe'],encoding:'utf8',windowsHide:true,timeout:60000})
   t.diagnostic('initdb exit code: 0\nstdout:\n'+stdout)
   return stdout
  }catch(error){
   t.diagnostic('initdb exit code: '+error.status+'\nstdout:\n'+(error.stdout||'')+'\nstderr:\n'+(error.stderr||''))
   throw error
  }
 }
 let started=false,supervisor,serial=0
 const connect=async(user,database='postgres')=>{const c=new Client({host:'127.0.0.1',port:p,user,database,connectionTimeoutMillis:5000});await c.connect();return c}
 const q=async(c,s,args=[])=>(await c.query(s,args)).rows
 async function lab(run){
  const name='f3c3_'+(++serial),clients=[]
  await supervisor.query('CREATE ROLE postgres LOGIN SUPERUSER INHERIT CREATEROLE CREATEDB BYPASSRLS')
  await supervisor.query(`CREATE DATABASE ${name} OWNER postgres`)
  let installer,admin
  try{
   installer=await connect('postgres',name);admin=await connect('supabase_admin',name);clients.push(installer,admin)
   await installer.query(fixture)
   await installer.query(photoSql)
   for(const m of legacy)await installer.query(read(m))
   await installer.query(`CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean); CREATE TABLE storage.objects(id integer,bucket_id text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY; CREATE POLICY preventivi ON storage.objects TO anon USING(bucket_id='preventivi') WITH CHECK(bucket_id='preventivi');`)
   await installer.query('INSERT INTO artecna_rapportini.sessioni_portale(token_sha256,operaio_id,scade_at) VALUES(sha256(convert_to($1,\'UTF8\')),$2,statement_timestamp()+interval \'8 hours\')',[TOKEN,OP])
   await installer.query('UPDATE public.rapportini SET versione_prestazioni=1 WHERE id=$1',[RAP])
   await supervisor.query('ALTER ROLE postgres NOSUPERUSER')
   const backend=await connect('artecna_rapportini_backend',name);clients.push(backend)
   const as=async(role,action)=>{await admin.query('SET SESSION AUTHORIZATION '+quote(role));try{return await action(admin)}finally{await admin.query('RESET SESSION AUTHORIZATION')}}
   const reserve=async()=> (await q(backend,reserveSql,[TOKEN,RAP,A,'2026-09-21',randomUUID(),'ab'.repeat(32),'image/jpeg',100]))[0].v
   const finalize=async r=>(await q(backend,finalizeSql,[TOKEN,r.allegato_id,r.lease_id]))[0].v
   const cancel=async r=>(await q(backend,cancelSql,[TOKEN,r.allegato_id]))[0].v
   const snapshot=async()=>({
    photos:await q(admin,'SELECT to_jsonb(f) v FROM public.foto_cantiere f ORDER BY id'),
    allegati:await q(admin,'SELECT to_jsonb(a) v FROM artecna_rapportini.allegati a ORDER BY id'),
    funcs:await q(admin,`SELECT oid,pg_get_functiondef(oid) def,proacl::text acl,proowner FROM pg_proc WHERE pronamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace) ORDER BY oid`),
    cols:await q(admin,`SELECT to_jsonb(a) v FROM pg_attribute a WHERE attrelid IN ('public.foto_cantiere'::regclass,'artecna_rapportini.allegati'::regclass) AND attnum>0 ORDER BY attrelid,attnum`),
    constraints:await q(admin,`SELECT to_jsonb(c) v FROM pg_constraint c WHERE conrelid IN ('public.foto_cantiere'::regclass,'artecna_rapportini.allegati'::regclass) ORDER BY oid`),
    triggers:await q(admin,`SELECT to_jsonb(t) v FROM pg_trigger t WHERE tgrelid IN ('public.foto_cantiere'::regclass,'artecna_rapportini.allegati'::regclass) ORDER BY oid`),
    acl:await q(admin,`SELECT oid,relacl::text,relrowsecurity FROM pg_class WHERE oid IN ('public.foto_cantiere'::regclass,'artecna_rapportini.allegati'::regclass)`),
    writer:await q(admin,"SELECT to_jsonb(r) v FROM pg_roles r WHERE rolname='artecna_foto_v1_writer'")
   })
   const install=()=>installer.query(sql)
   await run({installer,admin,backend,as,reserve,finalize,cancel,snapshot,install,q:c=>q(admin,c)})
  }finally{
   await Promise.allSettled(clients.map(c=>c.end()))
   await supervisor.query(`DROP DATABASE ${name} WITH (FORCE)`)
   await supervisor.query('REVOKE ALL ON DATABASE postgres FROM artecna_rapportini_backend')
   for(const role of ['artecna_foto_v1_writer','artecna_rapportini_backend','artecna_rapportini_rpc','artecna_cantieri_delete_rpc','anon','authenticated','service_role','postgres'])await supervisor.query('DROP ROLE IF EXISTS '+quote(role))
  }
 }
 try{
  ctl('initdb',['-D',data,'-U','supabase_admin','-A','trust','--no-locale','-E','UTF8'])
  ctl('pg_ctl',['-D',data,'-l',path.join(root,'postgres.log'),'-o',`-h 127.0.0.1 -p ${p}`,'-w','start']);started=true
  supervisor=await connect('supabase_admin')
  await t.test('zero proiezioni: installer non-superuser, ACL/fingerprint, solo cambi previsti',()=>lab(async h=>{
   const before=await h.snapshot();await h.install();const after=await h.snapshot()
   assert.deepEqual(after.acl,before.acl);assert.deepEqual(after.photos,before.photos);assert.deepEqual(after.allegati,before.allegati)
   assert.equal(after.cols.length,before.cols.length+1)
   for(const [sig,expected] of Object.entries(production.postHashes))assert.equal((await h.q(`SELECT encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') h FROM pg_proc WHERE oid='${sig}'::regprocedure`))[0].h,expected)
   assert.equal((await h.q('SELECT count(*)::integer n FROM artecna_rapportini.f3c3_capability'))[0].n,0)
  }))
  await t.test('backfill valido finalizzato e pending: cambia solo marker',()=>lab(async h=>{
   const r=await h.reserve(),f=await h.finalize(r),s=await h.reserve();await h.finalize(s);await h.cancel(s)
   const before=await h.snapshot();await h.install();const after=await h.snapshot()
   assert.deepEqual(after.photos.map(x=>{const v={...x.v};delete v.allegato_v1_id;return {v}}),before.photos)
   assert.deepEqual(after.allegati,before.allegati)
   assert.equal(after.photos.find(x=>x.v.id===f.foto_cantiere_id).v.allegato_v1_id,r.allegato_id)
  }))
  await t.test('default privileges permissivi: funzioni e capability restano private',()=>lab(async h=>{
   await h.installer.query('ALTER DEFAULT PRIVILEGES IN SCHEMA artecna_rapportini GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role; ALTER DEFAULT PRIVILEGES IN SCHEMA artecna_rapportini GRANT ALL ON TABLES TO anon,authenticated,service_role')
   await h.install()
   for(const role of ['anon','authenticated','service_role'])assert.equal((await q(h.admin,"SELECT has_table_privilege($1,'artecna_rapportini.f3c3_capability','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') v",[role]))[0].v,false)
  }))
  await t.test('migration CRLF: stessa installazione e fingerprint finali',()=>lab(async h=>{
   await h.installer.query(sql.replace(/\r?\n/g,'\r\n'));const r=await h.reserve();await h.finalize(r)
   for(const [sig,expected] of Object.entries(production.postHashes))assert.equal((await h.q(`SELECT encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') h FROM pg_proc WHERE oid='${sig}'::regprocedure`))[0].h,expected)
  }))
  const mutations=[
   ['marker presente','ALTER TABLE public.foto_cantiere ADD allegato_v1_id uuid'],
   ['colonna diversa','ALTER TABLE public.foto_cantiere ALTER data_foto TYPE varchar'],
   ['RLS attiva','ALTER TABLE public.foto_cantiere ENABLE ROW LEVEL SECURITY'],
   ['ACL tabella','REVOKE SELECT ON public.foto_cantiere FROM anon'],
   ['ACL colonna specifica','REVOKE UPDATE(cantiere_id) ON public.foto_cantiere FROM artecna_cantieri_delete_rpc'],
   ['vincolo mancante','ALTER TABLE public.foto_cantiere DROP CONSTRAINT foto_cantiere_cantiere_id_fkey'],
   ['indice extra','CREATE INDEX extra_photo ON public.foto_cantiere(categoria)'],
   ['registro diverso','ALTER TABLE artecna_rapportini.allegati ALTER byte_size TYPE numeric'],
   ['finalizzazione hash',"ALTER FUNCTION public.finalizza_allegato_rapportino_portale(text,uuid,uuid) SECURITY INVOKER"],
   ['finalizzazione ACL','GRANT EXECUTE ON FUNCTION public.finalizza_allegato_rapportino_portale(text,uuid,uuid) TO anon'],
   ['resolver metadata','ALTER FUNCTION artecna_rapportini.accesso_allegato_finalizzato(uuid,uuid,uuid,date) VOLATILE'],
  ]
  for(const [label,mutation] of mutations)await t.test('preflight '+label+': rollback totale',()=>lab(async h=>{
   await h.admin.query(mutation);const before=await h.snapshot();await assert.rejects(()=>h.install());await h.installer.query('ROLLBACK');assert.deepEqual(await h.snapshot(),before)
  }))
  for(const [label,mutation] of [
   ['contesto incoerente',"UPDATE public.foto_cantiere SET categoria='altro'"],
   ['campo canonico incoerente',"UPDATE public.foto_cantiere SET geolocalizzazione='fake'"],
  ])await t.test('backfill '+label+': abort senza correzioni',()=>lab(async h=>{
   await h.finalize(await h.reserve());await h.admin.query(mutation);const before=await h.snapshot()
   await assert.rejects(()=>h.install(),e=>e.code==='XX001');await h.installer.query('ROLLBACK');assert.deepEqual(await h.snapshot(),before)
  }))
  await t.test('backfill ambiguo: UNIQUE certificato impedisce duplicazione',()=>lab(async h=>{
   const a=await h.reserve(),f=await h.finalize(a),b=await h.reserve()
   await assert.rejects(()=>h.admin.query("UPDATE artecna_rapportini.allegati SET stato='finalizzato',finalized_at=statement_timestamp(),lease_id=NULL,lease_until=NULL,foto_cantiere_id=$1 WHERE id=$2",[f.foto_cantiere_id,b.allegato_id]),e=>e.code==='23505')
  }))
  for(const [label,inject] of [
   ['errore esplicito',"DO $$ BEGIN RAISE EXCEPTION 'F3C3 test post-check'; END $$;"],
   ['ACL legacy','REVOKE SELECT ON public.foto_cantiere FROM anon;'],
   ['guardia disattivata','ALTER TABLE public.foto_cantiere DISABLE TRIGGER f3c3_foto_dml;'],
   ['guardia corpo alterato',"CREATE OR REPLACE FUNCTION artecna_rapportini.f3c3_guardia_foto() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $$ BEGIN RETURN NEW; END $$;"],
   ['Storage','ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;'],
  ])await t.test('post-check '+label+': rollback totale',()=>lab(async h=>{
   const before=await h.snapshot();await assert.rejects(()=>h.installer.query(sql.replace('-- F3C3_POSTCHECK:',inject+'\n-- F3C3_POSTCHECK:')))
   await h.installer.query('ROLLBACK');assert.deepEqual(await h.snapshot(),before)
  }))
  await t.test('Mobile finalizza/retry/accesso/pending: contratto storico e marker',()=>lab(async h=>{
   await h.install();const r=await h.reserve(),f=await h.finalize(r)
   assert.deepEqual(await h.finalize(r),f)
   assert.equal((await h.q(`SELECT allegato_v1_id FROM public.foto_cantiere WHERE id='${f.foto_cantiere_id}'`))[0].allegato_v1_id,r.allegato_id)
   const access=(await q(h.backend,'SELECT public.autorizza_accesso_allegato_portale($1,$2) v',[TOKEN,r.allegato_id]))[0].v
   assert.equal(access.allegato_id,r.allegato_id);assert(!('allegato_v1_id' in access))
   await h.cancel(r);assert.equal((await h.q(`SELECT stato FROM artecna_rapportini.allegati WHERE id='${r.allegato_id}'`))[0].stato,'cancellazione_pending')
   await h.as('anon',async c=>assert.rejects(()=>c.query('UPDATE public.foto_cantiere SET nota=$1 WHERE id=$2',['fake',f.foto_cantiere_id]),e=>e.code==='42501'))
  }))
  for(const role of ['anon','authenticated','service_role'])await t.test(role+': V0 CRUD, falsificazione e batch V0/V1 atomici',()=>lab(async h=>{
   await h.install();const r=await h.reserve(),f=await h.finalize(r),id=randomUUID()
   await h.as(role,async c=>{
    await c.query("INSERT INTO public.foto_cantiere(id,nota) VALUES($1,'V0')",[id]);await c.query("UPDATE public.foto_cantiere SET nota='V0 aggiornato' WHERE id=$1",[id])
    for(const s of [
     `UPDATE public.foto_cantiere SET allegato_v1_id='${r.allegato_id}' WHERE id='${id}'`,
     `UPDATE public.foto_cantiere SET allegato_v1_id=NULL WHERE id='${f.foto_cantiere_id}'`,
     `UPDATE public.foto_cantiere SET allegato_v1_id='${randomUUID()}' WHERE id='${f.foto_cantiere_id}'`,
     `UPDATE public.foto_cantiere SET nota='fake' WHERE id='${f.foto_cantiere_id}'`,
     `DELETE FROM public.foto_cantiere WHERE id='${f.foto_cantiere_id}'`,
     `UPDATE public.foto_cantiere SET categoria='fake' WHERE id IN ('${id}','${f.foto_cantiere_id}')`,
     `DELETE FROM public.foto_cantiere WHERE id IN ('${id}','${f.foto_cantiere_id}')`,
     `INSERT INTO public.foto_cantiere(id,allegato_v1_id) VALUES('${randomUUID()}','${r.allegato_id}')`,
    ])await assert.rejects(()=>c.query(s),e=>e.code==='42501')
    assert.equal((await q(c,'SELECT nota FROM public.foto_cantiere WHERE id=$1',[id]))[0].nota,'V0 aggiornato')
    await c.query('DELETE FROM public.foto_cantiere WHERE id=$1',[id])
    await c.query("SELECT set_config('artecna.foto_v1_writer','true',false)")
    await assert.rejects(()=>c.query('UPDATE public.foto_cantiere SET nota=$1 WHERE id=$2',['fake',f.foto_cantiere_id]),e=>e.code==='42501')
    await assert.rejects(()=>c.query('SET ROLE artecna_foto_v1_writer'),e=>e.code==='42501')
   })
  }))
  await t.test('ACL writer/backend/PUBLIC: nessuna esecuzione o DML indiretti',()=>lab(async h=>{
   await h.install();const r=await h.reserve()
   for(const role of ['anon','authenticated','service_role','artecna_rapportini_backend','artecna_rapportini_rpc']){
    assert.equal((await q(h.admin,"SELECT has_function_privilege($1,'artecna_rapportini.crea_proiezione_foto_v1(uuid,uuid)','EXECUTE') v",[role]))[0].v,false)
    assert.equal((await q(h.admin,"SELECT has_function_privilege($1,'artecna_rapportini.f3c3_inserisci_proiezione(uuid,uuid)','EXECUTE') v",[role]))[0].v,false)
   }
   assert.equal((await h.q("SELECT has_table_privilege('artecna_foto_v1_writer','public.foto_cantiere','INSERT,UPDATE,DELETE,TRUNCATE') v"))[0].v,false)
   await assert.rejects(()=>h.backend.query('SELECT artecna_rapportini.crea_proiezione_foto_v1($1,$2)',[r.allegato_id,r.lease_id]),e=>e.code==='42501')
   // Anche un definer postgres non può creare il marker senza capability DB.
   await h.admin.query(`CREATE FUNCTION public.test_indiretto(uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN INSERT INTO public.foto_cantiere(allegato_v1_id) VALUES($1); END $$; ALTER FUNCTION public.test_indiretto(uuid) OWNER TO postgres; GRANT EXECUTE ON FUNCTION public.test_indiretto(uuid) TO anon;`)
   await h.as('anon',async c=>assert.rejects(()=>c.query('SELECT public.test_indiretto($1)',[r.allegato_id]),e=>e.code==='42501'))
  }))
  await t.test('lease scaduta e sessione Mobile invalida: errori preservati',()=>lab(async h=>{
   await h.install();const r=await h.reserve()
   await h.admin.query('UPDATE artecna_rapportini.allegati SET lease_until=statement_timestamp()-interval \'1 second\' WHERE id=$1',[r.allegato_id])
   await assert.rejects(()=>h.finalize(r),e=>e.code==='PR409'&&e.message==='Tentativo allegato non valido')
   await assert.rejects(()=>h.backend.query(finalizeSql,['bad',r.allegato_id,r.lease_id]),e=>e.code==='PR401')
  }))
  await t.test('deferred: writer intermedio permesso, COMMIT senza reciprocità negato',()=>lab(async h=>{
   await h.install();const r=await h.reserve()
   await h.backend.query('BEGIN');await h.backend.query('SET LOCAL ROLE postgres').catch(()=>{})
   // Privilegio installer controllato solo nel laboratorio per invocare writer col LOGIN backend.
   await h.backend.query('ROLLBACK')
   await h.admin.query('GRANT postgres TO artecna_rapportini_backend WITH INHERIT FALSE, SET TRUE')
   await h.backend.query('BEGIN');await h.backend.query('SET LOCAL ROLE postgres')
   await h.backend.query('SELECT artecna_rapportini.crea_proiezione_foto_v1($1,$2)',[r.allegato_id,r.lease_id])
   await assert.rejects(()=>h.backend.query('COMMIT'),e=>e.code==='XX001');await h.backend.query('ROLLBACK')
   assert.equal((await h.q('SELECT count(*)::integer n FROM public.foto_cantiere'))[0].n,0)
  }))
  await t.test('TRUNCATE CASCADE protetto; nessuna proiezione: comportamento FK legacy',()=>lab(async h=>{
   await h.install()
   await h.admin.query('BEGIN');await h.admin.query('TRUNCATE public.foto_cantiere,artecna_rapportini.allegati');await h.admin.query('ROLLBACK')
   const r=await h.reserve();await h.finalize(r)
   await assert.rejects(()=>h.admin.query('TRUNCATE public.foto_cantiere CASCADE'),e=>e.code==='42501')
   await h.as('anon',async c=>assert.rejects(()=>c.query('TRUNCATE public.foto_cantiere CASCADE'),e=>e.code==='42501'))
   await assert.rejects(()=>h.admin.query('DELETE FROM artecna_rapportini.allegati WHERE id=$1',[r.allegato_id]),e=>e.code==='23001'||e.code==='23503')
  }))
  await t.test('finalizzazione concorrente: unica proiezione e stesso risultato',()=>lab(async h=>{
   await h.install();const r=await h.reserve(),other=await connect('artecna_rapportini_backend',h.backend.database)
   try{const [a,b]=await Promise.all([h.finalize(r),q(other,finalizeSql,[TOKEN,r.allegato_id,r.lease_id]).then(x=>x[0].v)]);assert.deepEqual(a,b);assert.equal((await h.q('SELECT count(*)::integer n FROM public.foto_cantiere'))[0].n,1)}finally{await other.end()}
  }))
  await t.test('conflitti legacy riprodotti: rename, unlink e DELETE cantiere misti abortiscono senza filtri V0',()=>lab(async h=>{
   await h.install();const r=await h.reserve();await h.finalize(r)
   const name=(await q(h.admin,'SELECT nome FROM public.cantieri WHERE id=$1',[A]))[0].nome,id=randomUUID()
   await h.admin.query('INSERT INTO public.foto_cantiere(id,cantiere_id,cantiere,rapportino_id,nota) VALUES($1,$2,$3,$4,$5)',[id,A,name,RAP,'legacy'])
   const before=(await h.snapshot()).photos
   await h.as('anon',async c=>{
    await assert.rejects(()=>c.query('UPDATE public.foto_cantiere SET cantiere=$1 WHERE cantiere=$2',['nome nuovo',name]),e=>e.code==='42501')
    await assert.rejects(()=>c.query('UPDATE public.foto_cantiere SET rapportino_id=NULL WHERE rapportino_id=$1',[RAP]),e=>e.code==='42501')
   })
   await h.as('artecna_cantieri_delete_rpc',async c=>assert.rejects(()=>c.query('DELETE FROM public.foto_cantiere t WHERE t.cantiere_id=$1',[A]),e=>e.code==='42501'))
   assert.deepEqual((await h.snapshot()).photos,before)
   await h.as('artecna_cantieri_delete_rpc',async c=>c.query('DELETE FROM public.foto_cantiere WHERE id=$1',[id]))
  }))
 }finally{
  if(supervisor)await supervisor.end();if(started)ctl('pg_ctl',['-D',data,'-m','fast','-w','stop'])
  const resolved=path.resolve(root);if(path.dirname(resolved)!==path.resolve(clusterParent)||!path.basename(resolved).startsWith('artecna-f3c3-'))throw Error('Cleanup fuori scope')
  fs.rmSync(resolved,{recursive:true,force:true,maxRetries:10,retryDelay:200})
 }
})
