const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),fs=require('node:fs'),path=require('node:path')
const {withNative}=require('./native.cjs'),{load}=require('./load-ts.cjs'),root=path.resolve(__dirname,'../../..')
const {openStorageSession,storageConnectionConfig}=load(path.join(root,'app/engines/cantiere-delete/storageSession.server.ts'))
const {runStorageBatch,createStorageCleanupHandler}=load(path.join(root,'app/engines/cantiere-delete/storageEntrypoint.server.ts'))
const {consumeStorageJob}=load(path.join(root,'app/engines/cantiere-delete/storageWorker.server.ts'))
const dsn='postgresql://artecna_storage_worker_login.axuiaiglbahygsmeoypy:synthetic@fixture.pooler.supabase.com:5432/postgres?sslmode=require'
test('SESSION: DSN assente o transaction-pooler rifiutata senza connessioni',()=>{
 for(const value of [undefined,dsn.replace(':5432',':6543'),dsn.replace('5432','5433'),dsn.replace('require','disable')])assert.throws(()=>storageConnectionConfig(value),/STORAGE_SESSION_UNAVAILABLE/)
 assert.equal(storageConnectionConfig(dsn).ssl.rejectUnauthorized,true)
})
test('SESSION: backend cambiato o lock perso dopo COMMIT => fail closed e close',async()=>{
 for(const loseLock of [false,true]){let ended=false;const fake={on(){},connect:async()=>{},end:async()=>{ended=true},async query(sql){if(sql.includes('pg_try_advisory_lock'))return {rows:[{pid:1,identity:true,locked:true}]};if(sql.includes('FROM pg_locks'))return {rows:[{pid:loseLock?1:2,locked:!loseLock}]};return {rows:[]}}}
  await assert.rejects(openStorageSession({},()=>fake),/STORAGE_SESSION_UNAVAILABLE/);assert(ended)
 }
})
test('HTTP: anonymous, missing ENV, invalid limits and driver error never leak secrets',async()=>{
 const logs=[],old=console.error;console.error=(...v)=>logs.push(v)
 try{let connections=0;const base={secret:'synthetic-secret',databaseUrl:dsn,open:async()=>{connections++;throw Error('DSN synthetic-secret password-sensitive')},remover(){throw Error('must not call')}}
  const request=(query='',auth='synthetic-secret')=>new Request('http://localhost/api/internal/storage-cleanup'+query,{method:'POST',headers:auth?{authorization:'Bearer '+auth}:{}})
  const handler=createStorageCleanupHandler(base)
  assert.equal((await handler(request('',null))).status,401);assert.equal(connections,0)
  assert.equal((await handler(request('?mode=run&limit=3'))).status,400)
  assert.equal((await createStorageCleanupHandler({...base,databaseUrl:undefined})(request())).status,503)
  assert.equal((await createStorageCleanupHandler({...base,databaseUrl:dsn.replace(':5432',':6543')})(request('?mode=run'))).status,503);assert.equal(connections,0)
  const r=await handler(request());assert.equal(r.status,503);assert(!JSON.stringify(await r.json()).includes('synthetic-secret'));assert.deepEqual(logs,[])
 }finally{console.error=old}
})
test('batch: termine budget impedisce claim, limite rigido e connessione chiusa',async()=>{
 let closed=false;const r=await runStorageBatch(async()=>({connection:{query(){throw Error('must not claim')},release(){}},close:async()=>{closed=true}}),{remove(){throw Error('must not delete')}},{gate:false,limit:2},(()=>{let n=0;return()=>n++?14000:0})())
 assert.deepEqual(r.outcomes,[]);assert(closed)
})
test('batch: deadline chiude sessione e impedisce ack su esito HTTP tardivo',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let closed=false,ack=false,started,finishHTTP
 const entered=new Promise(r=>{started=r}),http=new Promise(r=>{finishHTTP=r})
 const connection={async query(sql){if(sql.includes('storage_finish'))ack=true;return {rows:sql.includes('storage_claim')?[{job:{id:'1',token:randomUUID(),lock_key:'123',bucket:'preventivi',path:'synthetic'}}]:[]}},release(){},async verifySession(){if(closed)throw Error('closed')}}
 const batch=runStorageBatch(async()=>({connection,async close(){closed=true;finishHTTP()}}),{async remove(){started();await http;return {ok:true}}},{gate:false,limit:1})
 await entered;t.mock.timers.tick(45000);await assert.rejects(batch);assert(closed);assert.equal(ack,false)
})
test('worker invocation: PostgreSQL 17.6 diretto, login reale, Storage controllato',{timeout:180000},async t=>withNative(async(db,connect,config)=>{
 const q=async(s,p=[]) => (await db.query(s,p)).rows
 const uid=randomUUID(),cid=randomUUID();await q('INSERT INTO auth.users VALUES($1)',[uid]);await q("INSERT INTO public.cantieri(id,nome) VALUES($1,'Session fixture')",[cid])
 const open=()=>openStorageSession(config)
 const ref=async(key)=>{const id=randomUUID();await q("INSERT INTO public.preventivi_cantiere(id,cantiere,cantiere_id,file_path) VALUES($1,'Session fixture',$2,$3)",[id,cid,key]);await q("SELECT artecna_distruzione.storage_autorizza_cleanup('preventivi',$1,'synthetic creator proof')",[key]);return id}
 const remove=id=>q('DELETE FROM public.preventivi_cantiere WHERE id=$1',[id])
 const expire=key=>q("UPDATE artecna_distruzione.cleanup_storage SET retry_at=clock_timestamp()-interval '1 second',lease_until=CASE WHEN lease_until IS NOT NULL THEN clock_timestamp()-interval '1 second' END WHERE path=$1",[key])
 const consume=(storage,opts={gate:false,limit:1})=>runStorageBatch(open,storage,opts)
 await t.test('migration login idempotente, membership ereditata e nessun privilegio applicativo diretto',async()=>{
  await q(fs.readFileSync(path.join(root,'supabase/migrations/20261107000700_storage_worker_login.sql'),'utf8'))
  const r=(await q("SELECT rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,pg_has_role(oid,'artecna_storage_worker','USAGE') member FROM pg_roles WHERE rolname='artecna_storage_worker_login'"))[0]
  assert.deepEqual(r,{rolcanlogin:true,rolinherit:true,rolsuper:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolbypassrls:false,member:true})
  const s=await open();try{await assert.rejects(s.connection.query('SELECT * FROM artecna_distruzione.storage_oggetti'),e=>e.code==='42501')}finally{await s.close()}
  await q('REVOKE artecna_storage_worker FROM artecna_storage_worker_login');await assert.rejects(open());await q('GRANT artecna_storage_worker TO artecna_storage_worker_login WITH INHERIT TRUE, SET FALSE')
 })
 await t.test('entrypoint HTTP gate non distruttivo; env separata; sessione chiusa',async()=>{
  const handler=createStorageCleanupHandler({secret:'synthetic',databaseUrl:dsn,open,probe:async()=>({ok:true,operation:'list_buckets'}),remover(){throw Error('gate must not construct remover')}})
  const r=await handler(new Request('http://localhost/api/internal/storage-cleanup?mode=gate',{method:'POST',headers:{authorization:'Bearer synthetic'}}));assert.equal(r.status,200);const evidence=await r.json();assert.equal(evidence.mode,'gate');assert.equal(evidence.pid_before,evidence.pid_after);assert.equal(evidence.advisory_released,true);assert.equal(evidence.no_claim,true);assert.equal(evidence.storage_probe.ok,true)
 })
 await t.test('riferimenti vivi/multipli conservano oggetto; HTTP run completa solo ultimo riferimento',async()=>{
  const x=await ref('shared-native'),y=await ref('shared-native');await remove(x)
  let calls=0;const storage={async remove(){calls++;return {ok:true}}};assert.deepEqual((await consume(storage)).outcomes,['idle']);assert.equal(calls,0)
  await remove(y);await expire('shared-native')
  const handler=createStorageCleanupHandler({secret:'synthetic',databaseUrl:dsn,open,remover:()=>storage})
  const r=await handler(new Request('http://localhost/api/internal/storage-cleanup?mode=run',{method:'POST',headers:{authorization:'Bearer synthetic'}}));assert.equal(r.status,200);assert.deepEqual((await r.json()).outcomes,['completed']);assert.equal(calls,1)
 })
 await t.test('stesso PID e advisory lock durante HTTP, writer bloccato, secondo worker idle, tombstone',async()=>{
  const id=await ref('race-native');await remove(id);const s=await open(),pid=(await s.connection.query('SELECT pg_backend_pid() pid')).rows[0].pid
  const observer=await connect(),writer=await connect();let attempts=0,waiting
  await s.connection.query('SELECT pg_advisory_lock(912345,6789)')
  try{await consumeStorageJob({connect:async()=>s.connection},{async remove(){attempts++
   assert.equal((await s.connection.query('SELECT pg_backend_pid() pid')).rows[0].pid,pid)
   assert.equal((await observer.query('SELECT pg_try_advisory_lock(912345,6789) ok')).rows[0].ok,false)
   const j=(await q("SELECT id,lease_id token FROM artecna_distruzione.cleanup_storage WHERE path='race-native'"))[0];assert.equal((await s.connection.query('SELECT artecna_distruzione.storage_verifica_job($1,$2) ok',[j.id,j.token])).rows[0].ok,true)
   waiting=writer.query("INSERT INTO public.preventivi_cantiere(id,cantiere,cantiere_id,file_path) VALUES($1,'Session fixture',$2,'race-native')",[randomUUID(),cid]).then(()=>null,e=>e)
   let blocked=false;for(let i=0;i<100;i++){if((await observer.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND NOT granted) ok")).rows[0].ok){blocked=true;break}await new Promise(r=>setTimeout(r,5))}assert(blocked)
   assert.deepEqual((await consume({remove(){throw Error('second worker must not delete')}})).outcomes,['idle'])
   return {ok:true}
  }})}finally{await s.close()}
  assert.equal(attempts,1);assert.equal((await waiting).code,'55000')
  assert.equal((await observer.query("SELECT count(*)::int n FROM pg_locks WHERE pid=$1 AND locktype='advisory'",[pid])).rows[0].n,0)
  assert.equal((await observer.query('SELECT pg_try_advisory_lock(912345,6789) ok')).rows[0].ok,true);await observer.query('SELECT pg_advisory_unlock(912345,6789)')
  await assert.rejects(ref('race-native'),e=>e.code==='55000')
 })
 await t.test('job duplicati e retry/assenza convergono; errore permanente resta failed',async()=>{
  const id=await ref('retry-native');await remove(id);await q("INSERT INTO artecna_distruzione.cleanup_storage(cantiere_id,bucket,path) VALUES(NULL,'preventivi','retry-native') ON CONFLICT DO NOTHING")
  assert.deepEqual((await consume({async remove(){return {ok:false,permanent:false,reason:'TIMEOUT'}}})).outcomes,['retry'])
  // A duplicate job may be ready already; all jobs share the immutable key.
  await expire('retry-native');assert.deepEqual((await consume({async remove(){return {ok:true}}})).outcomes,['completed'])
  assert((await q("SELECT stato FROM artecna_distruzione.cleanup_storage WHERE path='retry-native'")).every(r=>r.stato==='completed'))
  const p=await ref('permanent-native');await remove(p);assert.deepEqual((await consume({async remove(){return {ok:false,permanent:true,reason:'STORAGE_HTTP_403'}}})).outcomes,['failed'])
  assert.equal((await q("SELECT permanente FROM artecna_distruzione.cleanup_storage WHERE path='permanent-native'"))[0].permanente,true)
 })
 await t.test('sessione persa dopo DELETE: niente ack, lease scaduto e file assente completano',async()=>{
  const id=await ref('crash-native');await remove(id);const s=await open();let calls=0
  await assert.rejects(consumeStorageJob({connect:async()=>s.connection},{async remove(){calls++;await s.close();return {ok:true}}}))
  assert.notEqual((await q("SELECT stato FROM artecna_distruzione.cleanup_storage WHERE path='crash-native'"))[0].stato,'completed')
  await expire('crash-native');assert.deepEqual((await consume({async remove(){calls++;return {ok:true}}})).outcomes,['completed']);assert.equal(calls,2)
 })
 await t.test('perdita backend prima di HTTP impedisce DELETE',async()=>{
  const id=await ref('lost-native');await remove(id);const s=await open(),original=s.connection.verifySession;let calls=0
  s.connection.verifySession=async job=>{await s.close();return original(job)}
  await assert.rejects(consumeStorageJob({connect:async()=>s.connection},{async remove(){calls++;return {ok:true}}}));assert.equal(calls,0)
 })
 await t.test('timeout HTTP mantiene job ritentabile, senza completed prematuro',async()=>{
  // Reclaim the previous lost-session job; its immutable key stays gated.
  await expire('lost-native')
  assert.deepEqual((await consume({async remove(){throw new DOMException('synthetic timeout','TimeoutError')}})).outcomes,['retry'])
  const job=(await q("SELECT stato,ultimo_errore,lease_id FROM artecna_distruzione.cleanup_storage WHERE path='lost-native'"))[0]
  assert.equal(job.stato,'failed');assert.equal(job.ultimo_errore,'STORAGE_TRANSPORT');assert.equal(job.lease_id,null)
 })
}))
