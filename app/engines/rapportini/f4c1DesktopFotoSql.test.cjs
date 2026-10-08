// PostgreSQL 17.6 reale. JWT claims emulati come contesto PostgREST fidato;
// non e verifica crittografica HTTP/JWT ne Storage API.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {randomUUID}=require('node:crypto'),{Client}=require('pg')
const {A,B,RAP,USER}=require('./fixtureStep3.cjs')
const dir=path.resolve(__dirname,'../../../supabase/migrations')
const sql=fs.readFileSync(path.join(dir,'20261008_f4c1_lettura_foto_desktop.sql'),'utf8')
const source=fs.readFileSync(path.join(__dirname,'f3c37SequenceSql.test.cjs'),'utf8')
const declarations=[...source.matchAll(/^async function scenarios\s*\(/gm)];assert.equal(declarations.length,1)
const {baseline}=new Function('require','__dirname',source.slice(0,declarations[0].index)+';return {baseline};')(require,__dirname)
const production=require('./desktopLetturaProduction.fixture.json')
const q=async(c,s,p=[])=>(await c.query(s,p)).rows
const quote=s=>'"'+s.replaceAll('"','""')+'"'
async function setup(h){
 const install=await baseline(h);await install()
 // Riproduce gli helper JWT/membership Production, non i test.user condivisi.
 for(const f of production.filter(x=>x.firma.startsWith('artecna_guardie.'))){
  const acl=JSON.parse(f.acl_effettiva_catalogo)
  for(const a of acl)if(a.grantee!=='postgres')await h.admin.query('DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='+"'"+a.grantee+"'"+') THEN CREATE ROLE '+quote(a.grantee)+' NOLOGIN; END IF; END$$')
  await h.installer.query(f.definizione)
  const old=await q(h.admin,'SELECT DISTINCT grantee,pg_get_userbyid(grantee) name FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid=$1::regprocedure))',[f.firma])
  await h.installer.query('REVOKE ALL ON FUNCTION '+f.firma+' FROM PUBLIC')
  for(const a of old)if(a.grantee!==0&&a.name!=='postgres')await h.installer.query('REVOKE ALL ON FUNCTION '+f.firma+' FROM '+quote(a.name))
  for(const a of acl)await h.installer.query('GRANT EXECUTE ON FUNCTION '+f.firma+' TO '+quote(a.grantee))
 }
}
async function legacy(h){return{snapshot:await h.snapshot(),functions:await q(h.admin,"SELECT n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')' signature,to_jsonb(p) metadata,pg_get_userbyid(p.proowner) owner,l.lanname language FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang ORDER BY p.oid"),schema:await q(h.admin,"SELECT oid,nspacl::text FROM pg_namespace WHERE nspname IN ('public','artecna_rapportini','artecna_guardie') ORDER BY oid"),members:await q(h.admin,'SELECT to_jsonb(m) v FROM pg_auth_members m ORDER BY roleid,member,grantor')}}
async function assertAdditiveFunctions(h,before,after){
 const old=new Map(before.functions.map(f=>[f.signature,f]))
 const current=new Map(after.functions.map(f=>[f.signature,f]))
 assert.equal(old.size,before.functions.length);assert.equal(current.size,after.functions.length)
 for(const [signature,f] of old)assert.deepEqual(current.get(signature),f,'funzione preesistente: '+signature)
 const expected=new Map([
  ['public.elenca_foto_rapportino_desktop(uuid)',{acl:'{postgres=X/postgres,authenticated=X/postgres}',execute:['postgres','authenticated']}],
  ['artecna_foto_desktop.verifica(uuid, uuid)',{acl:'{postgres=X/postgres}',execute:['postgres']}],
  ['artecna_foto_desktop.risolvi(uuid, uuid)',{acl:'{postgres=X/postgres,artecna_rapportini_backend=X/postgres}',execute:['postgres','artecna_rapportini_backend']}]
 ])
 const added=after.functions.filter(f=>!old.has(f.signature))
 assert.deepEqual(added.map(f=>f.signature).sort(),[...expected.keys()].sort())
 for(const f of added){
  const contract=expected.get(f.signature)
  assert.equal(f.owner,'postgres');assert.equal(f.language,'plpgsql')
  assert.equal(f.metadata.prosecdef,true)
  assert.deepEqual(f.metadata.proconfig,['search_path=pg_catalog, pg_temp'])
  const acl=(await q(h.admin,'SELECT proacl::text acl FROM pg_proc WHERE oid=$1',[f.metadata.oid]))[0].acl
  assert.equal(acl,contract.acl,f.signature)
  for(const role of ['postgres','anon','authenticated','service_role','artecna_rapportini_rpc','artecna_rapportini_backend']){
   const allowed=(await q(h.admin,"SELECT has_function_privilege($1,$2::oid,'EXECUTE') allowed",[role,f.metadata.oid]))[0].allowed
   assert.equal(allowed,contract.execute.includes(role),f.signature+' EXECUTE '+role)
  }
 }
 const originalOids=new Set(before.snapshot.funcs.map(f=>f.oid))
 assert.deepEqual(after.snapshot.funcs.filter(f=>originalOids.has(f.oid)),before.snapshot.funcs)
 const {funcs:beforeFuncs,...beforeSnapshot}=before.snapshot
 const {funcs:afterFuncs,...afterSnapshot}=after.snapshot
 assert.deepEqual(afterSnapshot,beforeSnapshot)
 assert.deepEqual(after.schema,before.schema);assert.deepEqual(after.members,before.members)
}
async function desktop(h,id=RAP,user=USER){
 const c=h.admin;await c.query('BEGIN READ ONLY')
 try{await c.query('SET LOCAL ROLE authenticated');await c.query("SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims',$1,true)",[JSON.stringify(user?{sub:user,role:'authenticated'}:{role:'authenticated'})]);return(await q(c,'SELECT public.elenca_foto_rapportino_desktop($1) v',[id]))[0].v}
 finally{await c.query('ROLLBACK')}
}
const resolve=(h,id,user=USER)=>q(h.backend,'SELECT artecna_foto_desktop.risolvi($1,$2) v',[id,user])
async function finalized(h){const a=await h.reserve();await h.finalize(a);return a}
async function scenarios(t,lab){
 const run=async(n,fn)=>{let failure;await t.test(n,async()=>{try{await lab(fn)}catch(e){failure=e;throw e}});if(failure)throw failure}
 await run('installazione additiva, ACL Mobile/legacy invariate e resolver privato',async h=>{
  await setup(h);const before=await legacy(h);await h.installer.query(sql);await assertAdditiveFunctions(h,before,await legacy(h))
  for(const role of ['anon','authenticated','service_role','artecna_rapportini_rpc']){
   assert.equal((await q(h.admin,"SELECT has_function_privilege($1,'artecna_foto_desktop.risolvi(uuid,uuid)','EXECUTE') allowed",[role]))[0].allowed,false)
   await h.as(role,c=>assert.rejects(()=>c.query('SELECT artecna_foto_desktop.risolvi($1,$2)',[randomUUID(),USER]),e=>e.code==='42501'))
  }
  assert.equal((await q(h.admin,"SELECT has_function_privilege('artecna_rapportini_backend','artecna_foto_desktop.risolvi(uuid,uuid)','EXECUTE') allowed"))[0].allowed,true)
 })
 await run('Desktop owner autorizzato, mapping senza bucket/path; backend ricontrolla',async h=>{
  await setup(h);await h.installer.query(sql);const a=await finalized(h),out=await desktop(h)
  assert.equal(out.allegati.length,1);assert.equal(out.allegati[0].allegato_id,a.allegato_id);assert.equal(out.allegati[0].rapportino_id,RAP)
  assert.equal(out.allegati[0].foto_cantiere_id,(await q(h.admin,'SELECT foto_cantiere_id FROM artecna_rapportini.allegati WHERE id=$1',[a.allegato_id]))[0].foto_cantiere_id)
  assert(!JSON.stringify(out).includes('file_path'));assert(!JSON.stringify(out).includes('bucket'))
  const resolved=(await resolve(h,a.allegato_id))[0].v;assert.equal(resolved.bucket,'rapportini-v1');assert.equal(resolved.cantiere_id,A);assert.equal(resolved.sha256,'ab'.repeat(32));assert.deepEqual(await desktop(h),out)
 })
 await run('JWT assente e utente non owner negati',async h=>{
  await setup(h);await h.installer.query(sql);const a=await finalized(h)
  await assert.rejects(()=>desktop(h,RAP,null),e=>e.code==='PR401')
  await assert.rejects(()=>desktop(h,RAP,randomUUID()),e=>e.code==='42501')
  await assert.rejects(()=>resolve(h,a.allegato_id,randomUUID()),e=>e.code==='42501')
 })
 await run('membership soltanto su altro cantiere non autorizza Allegato',async h=>{
  await setup(h);await h.installer.query(sql);const a=await finalized(h),other=randomUUID()
  await h.admin.query("INSERT INTO public.utenti_cantiere VALUES($1,$2,'owner')",[B,other])
  await assert.rejects(()=>desktop(h,RAP,other),e=>e.code==='42501');await assert.rejects(()=>resolve(h,a.allegato_id,other),e=>e.code==='42501')
 })
 await run('prenotato e pending esclusi; resolver nega stato non finalizzato',async h=>{
  await setup(h);await h.installer.query(sql);const a=await h.reserve()
  assert.equal((await desktop(h)).allegati.length,0);await assert.rejects(()=>resolve(h,a.allegato_id),e=>e.code==='PR409')
  await h.finalize(a);await h.cancel(a);assert.equal((await desktop(h)).allegati.length,0);await assert.rejects(()=>resolve(h,a.allegato_id),e=>e.code==='PR409')
 })
 for(const mode of ['mancante','divergente','registro'])await run('corruzione fixture '+mode+': reciprocita fail-closed',async h=>{
  await setup(h);await h.installer.query(sql);const a=await finalized(h),before=await legacy(h)
  // Solo fixture amministrativa: danno transazionale con trigger RI/guardie non eseguiti;
  // ripristina origin PRIMA della lettura, rollback totale. Nessun DDL/disabilitazione permanente.
  await h.admin.query('BEGIN;SET LOCAL session_replication_role=replica')
  try{
   if(mode==='registro')await h.admin.query('UPDATE artecna_rapportini.allegati SET foto_cantiere_id=$1 WHERE id=$2',[randomUUID(),a.allegato_id])
   else await h.admin.query('UPDATE public.foto_cantiere SET allegato_v1_id=$1 WHERE allegato_v1_id=$2',[mode==='mancante'?null:randomUUID(),a.allegato_id])
   await h.admin.query('SET LOCAL session_replication_role=origin;SET LOCAL ROLE authenticated')
   await h.admin.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:USER,role:'authenticated'})])
   await assert.rejects(()=>h.admin.query('SELECT public.elenca_foto_rapportino_desktop($1)',[RAP]),e=>e.code==='XX001')
  }finally{await h.admin.query('ROLLBACK')}
  assert.deepEqual(await legacy(h),before)
 })
 await run('ripetizione abort, nessun cambiamento',async h=>{
  await setup(h);await h.installer.query(sql);const before=await legacy(h)
  await assert.rejects(()=>h.installer.query(sql),e=>e.code==='P0001');await h.installer.query('ROLLBACK');assert.deepEqual(await legacy(h),before)
 })
 await run('errore postcheck rollback schema/funzioni e privilegi',async h=>{
  await setup(h);const before=await legacy(h)
  await assert.rejects(()=>h.installer.query(sql.replace('-- F4C1_POSTCHECK',()=>"DO $$BEGIN RAISE EXCEPTION 'fault F4C1'; END$$;")),e=>e.code==='P0001');await h.installer.query('ROLLBACK')
  assert.deepEqual(await legacy(h),before);assert.equal((await q(h.admin,"SELECT to_regnamespace('artecna_foto_desktop')::text name"))[0].name,null)
 })
 await run('membership concorrente: snapshot prima commit, nuova richiesta dopo commit negata',async h=>{
  await setup(h);await h.installer.query(sql);const a=await finalized(h),p=h.admin.connectionParameters,c=new Client({host:p.host,port:p.port,database:p.database,user:'supabase_admin'})
  await c.connect();try{await c.query('BEGIN');await c.query('DELETE FROM public.utenti_cantiere WHERE cantiere_id=$1 AND user_id=$2',[A,USER]);assert.equal((await desktop(h)).allegati.length,1);await c.query('COMMIT');await assert.rejects(()=>desktop(h),e=>e.code==='42501');await assert.rejects(()=>resolve(h,a.allegato_id),e=>e.code==='42501')}finally{await c.query('ROLLBACK');await c.end()}
 })
}
const harness=fs.readFileSync(path.join(__dirname,'f3c37CoreSql.test.cjs'),'utf8')
const start=harness.indexOf("  await run('zero proiezioni"),tail=harness.lastIndexOf(' }finally{');assert(start>0&&tail>start)
new Function('require','__dirname','scenarios',harness.slice(0,start).replace('F3C3.7: core sostitutivo su PostgreSQL 17.6','F4C.1: lettura Foto Desktop PostgreSQL 17.6')+'  await scenarios(t,lab)\n'+harness.slice(tail))(require,__dirname,scenarios)
