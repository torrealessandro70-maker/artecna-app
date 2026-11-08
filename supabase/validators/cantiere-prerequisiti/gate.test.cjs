const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path')
const {load}=require('./load-ts.cjs'),root=path.resolve(__dirname,'../../..')
const {openStorageSession}=load(path.join(root,'app/engines/cantiere-delete/storageSession.server.ts'))
const {createStorageCleanupHandler}=load(path.join(root,'app/engines/cantiere-delete/storageEntrypoint.server.ts'))
const {createStorageRemover}=load(path.join(root,'app/engines/cantiere-delete/storageRemoval.server.ts'))
const evidence={current_user:'artecna_storage_worker_login',pooler_port:5432,pid_before:42,pid_after:42,same_pid:true,advisory_survived_commit:true,advisory_released:true}
const dsn='postgresql://artecna_storage_worker_login.axuiaiglbahygsmeoypy:synthetic@fixture.pooler.supabase.com:5432/postgres'
test('gate session: unlock boolean checked once, PID and surviving lock required',async()=>{
 for(const variant of ['ok','unlock-false','pid','lock']){
  let unlocks=0,closed=0
  const client={on(){},async connect(){},async end(){closed++},async query(sql){
   if(sql.includes('pg_try_advisory_lock'))return {rows:[{pid:42,identity:true,locked:true}]}
   if(sql.includes('FROM pg_locks'))return {rows:[{pid:variant==='pid'?43:42,locked:variant!=='lock'}]}
   if(sql.includes('pg_advisory_unlock')){unlocks++;return {rows:[{released:variant!=='unlock-false'}]}}
   return {rows:[]}
  }}
  if(variant==='ok'){const s=await openStorageSession({},()=>client);assert.deepEqual(s.evidence,evidence);await s.close()}
  else await assert.rejects(openStorageSession({},()=>client),/STORAGE_SESSION_UNAVAILABLE/)
  assert.equal(closed,1);assert.equal(unlocks,['pid','lock'].includes(variant)?0:1)
 }
})
test('gate HTTP: real adapter LIST only; errors sanitized; no claim/remove/update',async()=>{
 for(const fault of [null,401,403,500,'network']){
  let list=0,closed=0;const logs=[],old=console.error;console.error=(...v)=>logs.push(v)
  try{
   const storage=createStorageRemover({storage:{async listBuckets(){list++;if(fault==='network')throw Error('synthetic-secret private DSN');return {data:[{name:'private-bucket'}],error:fault?{status:fault,message:'synthetic-secret'}:null}},from(){throw Error('must not remove')}}})
   const handler=createStorageCleanupHandler({secret:'synthetic-secret',databaseUrl:dsn,open:async()=>({evidence,connection:{query(){throw Error('must not claim/update')},release(){}},async close(){closed++}}),probe:()=>storage.probe(),remover(){throw Error('must not construct run remover')}})
   const response=await handler(new Request('https://fixture/api/internal/storage-cleanup?mode=gate',{method:'POST',headers:{authorization:'Bearer synthetic-secret'}}))
   const body=await response.json();assert.equal(response.status,fault?503:200)
   if(!fault)assert.deepEqual(body,{mode:'gate',ok:true,...evidence,storage_probe:{ok:true,operation:'list_buckets'},no_claim:true,no_storage_delete:true})
   assert(!/synthetic-secret|private-bucket|DSN/.test(JSON.stringify(body)));assert.deepEqual(logs,[]);assert.equal(list,1);assert.equal(closed,1)
  }finally{console.error=old}
 }
})
test('gate: missing service credential, DSN, probe or invalid session fail closed',async()=>{
 for(const change of [{secret:undefined},{databaseUrl:undefined},{probe:undefined},{open:async()=>({evidence:{...evidence,advisory_released:false},connection:{},async close(){}})}]){
  const handler=createStorageCleanupHandler({secret:'synthetic',databaseUrl:dsn,open:async()=>({evidence,connection:{},async close(){}}),probe:async()=>({ok:true,operation:'list_buckets'}),remover(){throw Error('must not run')},...change})
  assert.equal((await handler(new Request('https://fixture/api/internal/storage-cleanup?mode=gate',{method:'POST',headers:{authorization:'Bearer synthetic'}}))).status,503)
 }
})
