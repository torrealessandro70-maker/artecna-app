/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {withNative}=require('./native.cjs'),{certifiedInstallerFixture,identityQuery,membershipQuery,expected}=require('./installerBaseline.cjs');
const sql=fs.readFileSync(path.join(__dirname,'../../migrations/20261108000800_cantiere_hard_delete_finale.sql'),'utf8').replace(/\r\n/g,'\n');
test('installer 008 R2: PostgreSQL 17.6, NOSUPERUSER, grantor distinti, transazione atomica',{timeout:240000},t=>withNative(async(db,connect)=>{
 const admin=await connect('fixture_admin'),q=async(c,s,p)=>(await c.query(s,p)).rows;
 const snapshot=async()=>({rpc:(await q(db,identityQuery))[0].identity,memberships:(await q(db,membershipQuery))[0].memberships,schema:(await q(db,"SELECT nspacl::text acl,nspowner::regrole::text owner FROM pg_namespace WHERE nspname='public'"))[0],new_helper:(await q(db,"SELECT to_regprocedure('artecna_distruzione.hard_delete_catalog()') helper"))[0].helper});
 const before=await snapshot();assert.deepEqual(before.rpc,expected);assert.equal((await q(db,'SELECT rolsuper FROM pg_roles WHERE rolname=current_user'))[0].rolsuper,false);
 async function rolledBack(name,setup,statement=sql,pattern){await t.test(name,async()=>{
  await admin.query('BEGIN');try{if(setup)await setup(admin);await admin.query('SET SESSION AUTHORIZATION postgres');await assert.rejects(admin.query(statement),pattern);}finally{await admin.query('ROLLBACK');await admin.query('RESET SESSION AUTHORIZATION');}
  assert.deepEqual(await snapshot(),before,'owner, ACL, source, schema and complete membership catalog restored');
 });}
 await t.test('B: SET=false senza capability rifiuta SET ROLE',async()=>{await db.query('BEGIN');await assert.rejects(db.query('SET ROLE artecna_cantieri_delete_rpc'),e=>e.code==='42501');await db.query('ROLLBACK');assert.deepEqual(await snapshot(),before);});
 await t.test('C/D/N: replacement esistente richiede CREATE; capability temporanee ripristinate esattamente',async()=>{
  await admin.query('BEGIN');try{
   await admin.query("CREATE ROLE postgres_fixture LOGIN CREATEROLE; GRANT CREATE ON SCHEMA public TO postgres_fixture WITH GRANT OPTION; GRANT artecna_cantieri_delete_rpc TO postgres_fixture WITH ADMIN TRUE, SET FALSE, INHERIT FALSE GRANTED BY supabase_admin; CREATE FUNCTION public.replace_probe() RETURNS int LANGUAGE sql AS 'SELECT 1'; ALTER FUNCTION public.replace_probe() OWNER TO artecna_cantieri_delete_rpc; REVOKE ALL ON FUNCTION public.replace_probe() FROM PUBLIC");
   const schema=(await q(admin,"SELECT nspacl::text acl FROM pg_namespace WHERE nspname='public'"))[0].acl,rows=()=>q(admin,"SELECT to_jsonb(m) row FROM pg_auth_members m WHERE roleid='artecna_cantieri_delete_rpc'::regrole AND member='postgres_fixture'::regrole ORDER BY grantor");const original=await rows();
   const probe=()=>q(admin,"SELECT oid,proowner,proacl::text FROM pg_proc WHERE oid='public.replace_probe()'::regprocedure");const originalProbe=await probe();
   await admin.query('SET SESSION AUTHORIZATION postgres_fixture');await admin.query('GRANT artecna_cantieri_delete_rpc TO postgres_fixture WITH ADMIN FALSE, SET TRUE, INHERIT FALSE GRANTED BY postgres_fixture');assert.equal((await rows()).length,2);
   await admin.query('SAVEPOINT no_create');await admin.query('SET ROLE artecna_cantieri_delete_rpc');assert.equal((await q(admin,"SELECT has_schema_privilege(current_user,'public','CREATE') ok"))[0].ok,false);
   await assert.rejects(admin.query("CREATE OR REPLACE FUNCTION public.replace_probe() RETURNS int LANGUAGE sql AS 'SELECT 2'"),e=>e.code==='42501'&&/schema public/.test(e.message));await admin.query('ROLLBACK TO no_create');await admin.query('RESET ROLE');
   await admin.query('GRANT CREATE ON SCHEMA public TO artecna_cantieri_delete_rpc');await admin.query('SET ROLE artecna_cantieri_delete_rpc');await admin.query("CREATE OR REPLACE FUNCTION public.replace_probe() RETURNS int LANGUAGE sql AS 'SELECT 2'");await admin.query('RESET ROLE');await admin.query('REVOKE CREATE ON SCHEMA public FROM artecna_cantieri_delete_rpc RESTRICT');await admin.query('REVOKE artecna_cantieri_delete_rpc FROM postgres_fixture GRANTED BY postgres_fixture RESTRICT');
   assert.deepEqual(await rows(),original);assert.deepEqual(await probe(),originalProbe);assert.equal((await q(admin,"SELECT nspacl::text acl FROM pg_namespace WHERE nspname='public'"))[0].acl,schema);
  }finally{await admin.query('ROLLBACK');await admin.query('RESET SESSION AUTHORIZATION');}assert.deepEqual(await snapshot(),before);
 });
 await rolledBack('E: errore dopo GRANT, prima SET ROLE',null,sql.replace('-- INSTALLER_TEMP_GRANT_READY','SELECT 1/0;'),e=>e.code==='22012');
 const badCreate=sql.replace(/(CREATE OR REPLACE FUNCTION public\.elimina_cantiere_definitivamente[\s\S]*?)LANGUAGE plpgsql/,'$1LANGUAGE installer_missing_language');
 assert.notEqual(badCreate,sql);await rolledBack('F: errore durante CREATE OR REPLACE',null,badCreate,e=>e.code==='42704');
 await rolledBack('G: errore dopo replacement, prima cleanup capability',null,sql.replace('-- INSTALLER_REPLACEMENT_READY','SELECT 1/0;'),e=>e.code==='22012');
 for(const step of ['TEMP_CREATE_READY','SET_ROLE_READY','CREATE_READY','CREATE_REVOKED','SET_REVOKED','COMMIT_READY']){
  const marker='-- INSTALLER_'+step;assert(sql.includes(marker));
  await rolledBack('rollback dopo '+step,null,sql.replace(marker,'SELECT 1/0;'),e=>e.code==='22012');
 }
 await rolledBack('H: source baseline diversa STOP prima GRANT',a=>a.query(expected.source?require('./production-rpc-baseline.json').definition.replace('DECLARE','DECLARE\n-- injected source drift'):''),sql,e=>e.code==='P2113');
 await rolledBack('I: ACL RPC diversa STOP',a=>a.query('GRANT EXECUTE ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) TO anon'),sql,e=>e.code==='P2113');
 await rolledBack('J: owner RPC diverso STOP',a=>a.query('ALTER FUNCTION public.elimina_cantiere_definitivamente(uuid,text) OWNER TO postgres'),sql,e=>e.code==='P2113');
 await rolledBack('K: membership originale diversa STOP',a=>a.query('GRANT artecna_cantieri_delete_rpc TO postgres WITH ADMIN TRUE, SET TRUE, INHERIT FALSE GRANTED BY supabase_admin'),sql,e=>e.code==='42501');
 await rolledBack('L: grantor aggiuntivo inatteso STOP',a=>a.query('GRANT artecna_cantieri_delete_rpc TO postgres WITH ADMIN FALSE, SET FALSE, INHERIT FALSE'),sql,e=>e.code==='42501');
 await t.test('A/D: stato Production esatto GREEN; OID, owner, ACL, schema e membership before=after',async()=>{
  assert.equal((await q(db,"SELECT has_schema_privilege('artecna_cantieri_delete_rpc','public','CREATE') ok"))[0].ok,false);await db.query(sql);const after=await snapshot();
  assert.deepEqual(after.memberships,before.memberships);assert.deepEqual(after.schema,before.schema);const {source:oldSource,source_md5:oldHash,...oldMetadata}=before.rpc,{source:newSource,source_md5:newHash,...newMetadata}=after.rpc;assert.notEqual(newSource,oldSource);assert.notEqual(newHash,oldHash);assert.deepEqual(newMetadata,oldMetadata);
  assert.equal((await q(db,"SELECT count(*)::int n FROM pg_auth_members WHERE roleid='artecna_cantieri_delete_rpc'::regrole AND member='postgres'::regrole"))[0].n,1);assert.equal((await q(db,"SELECT has_schema_privilege('artecna_cantieri_delete_rpc','public','CREATE') ok"))[0].ok,false);
  await db.query('BEGIN');await assert.rejects(db.query('SET ROLE artecna_cantieri_delete_rpc'),e=>e.code==='42501');await db.query('ROLLBACK');
  await assert.rejects(db.query(sql),e=>e.code==='P2113'&&/RPC baseline/.test(e.message));await db.query('ROLLBACK');assert.deepEqual(await snapshot(),after,'second execution fails closed without privilege/catalog changes');
 });
},{productionActor:true,beforeMigrations:certifiedInstallerFixture}));
