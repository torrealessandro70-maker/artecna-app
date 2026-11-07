const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {withNative}=require('./native.cjs'),{catalogFidelity}=require('./catalogFidelity.cjs')
test('precheck reale: prefix 0, ruoli assenti e postgres NOSUPERUSER => GREEN_APPLY_7',{timeout:180000},async t=>withNative(async(db,connect)=>{
 const sql=fs.readFileSync(path.join(__dirname,'production-precheck-readonly.sql'),'utf8');assert(sql.startsWith(String.fromCharCode(92)+'set ON_ERROR_STOP on\n'))
 const query=sql.substring(sql.indexOf('\n')+1)
 const probe=async()=>{const results=await db.query(query);return results.find(r=>r.rows?.[0]?.result)?.rows[0].result}
 const actor=(await db.query('SELECT current_user,session_user,rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0]
 assert.deepEqual(actor,{current_user:'postgres',session_user:'postgres',rolsuper:false,rolcreaterole:true,rolcreatedb:true,rolreplication:true,rolbypassrls:true})
 const result=await probe();assert.equal(result.verdict,'GREEN_APPLY_7');assert.equal(result.installer_superuser,false);assert.equal(result.installer_createrole,true)
 assert.equal(result.matched_prefix,0);assert.equal(result.role_worker_status,'ABSENT');assert.equal(result.role_login_status,'ABSENT');assert.equal(result.drift_status,'NO_CATALOG_DRIFT')
 for(let i=1;i<=7;i++)assert.equal(result['migration_'+String(i).padStart(3,'0')+'_status'],'NOT_APPLIED')
 assert.equal((await db.query("SELECT count(*)::int n FROM pg_roles WHERE rolname IN ('artecna_storage_worker','artecna_storage_worker_login')")).rows[0].n,0)
 const directory=path.resolve(__dirname,'../../../.run/cantiere-precheck');fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'real-nonsuperuser-prefix0-result.json'),JSON.stringify({actor,result},null,2)+'\n')
 const admin=await connect('fixture_admin')
 await t.test('mancanza CREATEROLE: blocker reale',async()=>{
  await admin.query('ALTER ROLE postgres NOCREATEROLE');try{assert.equal((await probe()).verdict,'STOP_INSTALLER_CREATEROLE')}finally{await admin.query('ALTER ROLE postgres CREATEROLE')}
 })
 await t.test('authority schema assente => STOP senza richiedere SUPERUSER',async()=>{
  await admin.query('REVOKE CREATE ON SCHEMA artecna_distruzione FROM postgres');try{assert.equal((await probe()).verdict,'STOP_INSTALLER_SCHEMA_AUTHORITY')}finally{await admin.query('GRANT CREATE ON SCHEMA artecna_distruzione TO postgres')}
 })
},{productionActor:true,through:0,beforeMigrations:catalogFidelity}))
