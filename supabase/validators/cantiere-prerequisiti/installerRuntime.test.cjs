/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {withNative}=require('./native.cjs'),{certifiedInstallerFixture,identityQuery,membershipQuery}=require('./installerBaseline.cjs');
const load=n=>fs.readFileSync(path.join(__dirname,'../../migrations',n),'utf8').replace(/\r\n/g,'\n'),base=load('20261108000800_cantiere_hard_delete_finale.sql'),runtime=load('20261108000900_cantiere_hard_delete_runtime_v2.sql');
test('installer 009 preserves RPC metadata, original grants, coarse locks and timeouts',{timeout:180000},t=>withNative(async(db,connect)=>{
 const admin=await connect('fixture_admin');await db.query(base);
 const snapshot=async()=>({rpc:(await db.query(identityQuery)).rows[0].identity,members:(await db.query(membershipQuery)).rows[0].memberships,schema:(await db.query("SELECT nspacl::text acl,nspowner FROM pg_namespace WHERE nspname='public'")).rows[0],lock:(await db.query("SELECT prosrc FROM pg_proc WHERE oid='artecna_distruzione.hard_delete_lock(uuid)'::regprocedure")).rows[0].prosrc,roles:(await db.query("SELECT rolname,rolconfig FROM pg_roles WHERE rolname IN('authenticated','authenticator','artecna_cantieri_delete_rpc') ORDER BY rolname")).rows});
 const before=await snapshot();assert.equal((await db.query('SELECT rolsuper FROM pg_roles WHERE rolname=current_user')).rows[0].rolsuper,false);
 for(const [name,setup] of [['ACL',"GRANT EXECUTE ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) TO anon"],['owner',"ALTER FUNCTION public.elimina_cantiere_definitivamente(uuid,text) OWNER TO postgres"],['helper',"ALTER FUNCTION artecna_distruzione.hard_delete_preserved(uuid,jsonb) SECURITY INVOKER"]])await t.test(name+' drift STOP before grants',async()=>{
  await admin.query('BEGIN');try{await admin.query(setup);await admin.query('SET SESSION AUTHORIZATION postgres');await assert.rejects(admin.query(runtime),e=>e.code==='P2113');}finally{await admin.query('ROLLBACK');await admin.query('RESET SESSION AUTHORIZATION');}assert.deepEqual(await snapshot(),before);
 });
 for(const [name,token] of [['helpers','\nGRANT artecna_cantieri_delete_rpc TO postgres'],['temporary SET','\nDO $$ BEGIN IF(SELECT needs_create'],['temporary CREATE','\nSET ROLE artecna_cantieri_delete_rpc;'],['replacement','\nRESET ROLE;'],['revokes','\nUPDATE artecna_distruzione.hard_delete_catalog_expected']])await t.test('rollback after '+name,async()=>{
  assert(runtime.includes(token));const injected=runtime.replace(token,()=> '\nSELECT 1/0;'+token);await admin.query('BEGIN');try{await admin.query('SET SESSION AUTHORIZATION postgres');await assert.rejects(admin.query(injected),e=>e.code==='22012');}finally{await admin.query('ROLLBACK');await admin.query('RESET SESSION AUTHORIZATION');}assert.deepEqual(await snapshot(),before);
 });
 await t.test('NOSUPERUSER install GREEN; metadata/capabilities restored, second run STOP',async()=>{
  await db.query(runtime);const after=await snapshot(),a={...after.rpc},b={...before.rpc};delete a.source;delete a.source_md5;delete b.source;delete b.source_md5;assert.deepEqual(a,b);assert.notEqual(after.rpc.source_md5,before.rpc.source_md5);assert.deepEqual(after.members,before.members);assert.deepEqual(after.schema,before.schema);assert.equal(after.lock,before.lock);assert.deepEqual(after.roles,before.roles);
  await assert.rejects(db.query(runtime),e=>e.code==='P2113');await db.query('ROLLBACK');assert.deepEqual(await snapshot(),after);
 });
},{productionActor:true,beforeMigrations:certifiedInstallerFixture}));
