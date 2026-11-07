const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {withNative}=require('./native.cjs'),root=path.resolve(__dirname,'../../..')
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261107000700_storage_worker_login.sql'),'utf8')
const body=migration.replace(/^BEGIN;\s*/,'').replace(/COMMIT;\s*$/,'')
const flags="SELECT rolname,rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls,rolcanlogin,rolinherit FROM pg_roles WHERE rolname IN ('postgres','artecna_storage_worker','artecna_storage_worker_login') ORDER BY rolname"
test('007 non contiene ALTER ROLE, password o attributi di sicurezza espliciti in CREATE',()=>{
 const code=migration.replace(/--[^\n]*/g,'');assert(!/\bALTER\s+ROLE\b/i.test(code));assert(!/\bPASSWORD\b/i.test(code))
 assert.deepEqual(code.match(/CREATE ROLE[^;]+;/g),['CREATE ROLE artecna_storage_worker NOLOGIN INHERIT;','CREATE ROLE artecna_storage_worker_login LOGIN INHERIT;'])
})
test('007: PG17.6, actor postgres realmente non-superuser, casi fail-closed',{timeout:240000},async t=>withNative(async(db,connect)=>{
 const admin=await connect('fixture_admin'),q=async(s,p=[]) => (await admin.query(s,p)).rows
 const actor=(await db.query("SELECT session_user,current_user,rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0]
 assert.deepEqual(actor,{session_user:'postgres',current_user:'postgres',rolsuper:false,rolcreaterole:true,rolcreatedb:true,rolreplication:true,rolbypassrls:true})
 async function scenario(seed,expected,inspect){
  await q('BEGIN')
  try{
   if(seed)await q(seed)
   await q('SET LOCAL ROLE postgres');await q('SAVEPOINT attempt')
   if(expected){await assert.rejects(q(body),e=>e.message.includes(expected));await q('ROLLBACK TO attempt')}
   else await q(body)
   await q('RESET ROLE');if(inspect)await inspect(q)
  }finally{await q('ROLLBACK')}
 }
 await t.test('worker/login assenti: CREATE minimo, default sicuri e ADMIN del creatore',async()=>scenario('DROP OWNED BY artecna_storage_worker; DROP ROLE artecna_storage_worker',null,async q=>{
  const roles=await q(flags);for(const r of roles.filter(r=>r.rolname!=='postgres'))assert.deepEqual([r.rolsuper,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolbypassrls,r.rolinherit],[false,false,false,false,false,true])
  assert.equal(roles.find(r=>r.rolname==='artecna_storage_worker').rolcanlogin,false);assert.equal(roles.find(r=>r.rolname==='artecna_storage_worker_login').rolcanlogin,true)
  assert.equal((await q("SELECT admin_option FROM pg_auth_members WHERE roleid='artecna_storage_worker'::regrole AND member='postgres'::regrole"))[0].admin_option,true)
 }))
 await t.test('senza CREATEROLE: STOP prima di creare login',async()=>scenario('ALTER ROLE postgres NOCREATEROLE','richiesto postgres con CREATEROLE',async q=>assert.equal((await q("SELECT count(*)::int n FROM pg_roles WHERE rolname='artecna_storage_worker_login'"))[0].n,0)))
 await t.test('worker esistente corretto: PASS',async()=>scenario(null,null))
 for(const [attribute,label]of [['SUPERUSER','SUPERUSER'],['LOGIN','LOGIN'],['CREATEROLE','CREATEROLE'],['BYPASSRLS','BYPASSRLS'],['NOINHERIT','NOINHERIT']])await t.test('worker '+label+': STOP senza riparazione',async()=>scenario('ALTER ROLE artecna_storage_worker '+attribute,'Attributi capability Storage inattesi'))
 for(const attribute of ['CREATEROLE','BYPASSRLS','NOINHERIT'])await t.test('login '+attribute+': STOP',async()=>scenario('CREATE ROLE artecna_storage_worker_login LOGIN '+attribute,'Attributi login Storage inattesi'))
 await t.test('membership errata: STOP, nessuna rettifica automatica',async()=>scenario('CREATE ROLE artecna_storage_worker_login LOGIN INHERIT; GRANT artecna_storage_worker TO artecna_storage_worker_login WITH ADMIN TRUE, INHERIT FALSE, SET TRUE','Membership login Storage inattesa',async q=>{
  const r=(await q("SELECT admin_option,inherit_option,set_option FROM pg_auth_members WHERE roleid='artecna_storage_worker'::regrole AND member='artecna_storage_worker_login'::regrole"))[0];assert.deepEqual(r,{admin_option:true,inherit_option:false,set_option:true})
 }))
 await t.test('authority ADMIN worker assente: STOP anche con CREATEROLE',async()=>scenario('REVOKE artecna_storage_worker FROM postgres','ADMIN OPTION sulla capability Storage assente'))
 await t.test('worker con parent inatteso: STOP',async()=>scenario('GRANT anon TO artecna_storage_worker','Capability Storage eredita ruoli inattesi'))
 await t.test('seconda esecuzione: ACL e membership identiche, senza nuovo GRANT membership',async()=>scenario(null,null,async q=>{
  const snapshot=async()=>({roles:await q(flags),membership:await q("SELECT roleid,member,grantor,admin_option,inherit_option,set_option,xmin::text FROM pg_auth_members WHERE roleid='artecna_storage_worker'::regrole OR member='artecna_storage_worker_login'::regrole ORDER BY roleid,member,grantor"),acl:await q("SELECT p.oid,p.proowner,p.proacl,p.prosrc FROM pg_proc p WHERE p.oid='artecna_distruzione.storage_verifica_job(bigint,uuid)'::regprocedure")})
  const before=await snapshot();await q('SET LOCAL ROLE postgres');await q(body);await q('RESET ROLE');assert.deepEqual(await snapshot(),before)
 }))
 await t.test('membership esatta non richiede un nuovo grant amministrativo',async()=>scenario('CREATE ROLE artecna_storage_worker_login LOGIN INHERIT; GRANT artecna_storage_worker TO artecna_storage_worker_login WITH ADMIN FALSE, INHERIT TRUE, SET FALSE; REVOKE artecna_storage_worker FROM postgres',null))
 await t.test('helper esistente owner errato: STOP senza ALTER OWNER',async()=>{
  const start=migration.indexOf('CREATE OR REPLACE FUNCTION'),end=migration.indexOf('$$;',start)+3
  await scenario(migration.slice(start,end),'Helper Storage esistente divergente',async q=>assert.equal((await q("SELECT pg_get_userbyid(proowner) owner FROM pg_proc WHERE oid='artecna_distruzione.storage_verifica_job(bigint,uuid)'::regprocedure"))[0].owner,'fixture_admin'))
 })
 await t.test('helper ACL divergenti: STOP senza revocarle automaticamente',async()=>scenario(null,null,async q=>{
  await q('GRANT EXECUTE ON FUNCTION artecna_distruzione.storage_verifica_job(bigint,uuid) TO authenticated')
  await q('SET LOCAL ROLE postgres');await q('SAVEPOINT acl_check');await assert.rejects(q(body),/Helper Storage esistente divergente/);await q('ROLLBACK TO acl_check');await q('RESET ROLE')
  assert.equal((await q("SELECT has_function_privilege('authenticated','artecna_distruzione.storage_verifica_job(bigint,uuid)','EXECUTE') ok"))[0].ok,true)
 }))
},{productionActor:true,through:6}))
test('001–007 installabili in sequenza da postgres NOSUPERUSER; worker eredita EXECUTE',{timeout:180000},async()=>withNative(async(db,connect)=>{
 const flags=(await db.query("SELECT session_user,rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0]
 assert.equal(flags.session_user,'postgres');assert.equal(flags.rolsuper,false)
 assert(flags.rolcreaterole&&flags.rolcreatedb&&flags.rolreplication&&flags.rolbypassrls)
 const login=await connect('artecna_storage_worker_login')
 const r=(await login.query("SELECT session_user,pg_has_role(session_user,'artecna_storage_worker','USAGE') inherited,has_function_privilege(current_user,'artecna_distruzione.storage_claim()','EXECUTE') claim,has_function_privilege(current_user,'artecna_distruzione.storage_finish(bigint,uuid,boolean,boolean,text)','EXECUTE') finish")).rows[0]
 assert.deepEqual(r,{session_user:'artecna_storage_worker_login',inherited:true,claim:true,finish:true})
 await db.query(migration)
},{productionActor:true}))
