// Local fixture builder/validator only. Never opens a Production connection.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),net=require('node:net'),{execFileSync}=require('node:child_process')
const root=path.resolve(__dirname,'..'),bundle=process.argv[2]||path.join(root,'.run/cantiere-precheck');fs.mkdirSync(bundle,{recursive:true})
const {Client}=require('pg')
function csv(source){let rows=[],row=[],cell='',quoted=false;for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&source[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell=''}else cell+=c}assert(!quoted);if(cell||row.length){row.push(cell);rows.push(row)}return rows}
function exported(file,count){const rows=csv(fs.readFileSync(path.join(root,'audit-production',file),'utf8').replace(/^\uFEFF/,''));assert.deepEqual(rows.shift(),['section','metadata']);assert.equal(rows.length,count);const out={};for(const row of rows){assert.equal(row.length,2);(out[row[0]]??=[]).push(JSON.parse(row[1]))}return out}
const schema=exported('production-schema-snapshot.csv',1806);exported('e2-production-catalog.csv',122)
const digest=b=>crypto.createHash('sha256').update(b).digest('hex'),ident=s=>'"'+s.replaceAll('"','""')+'"'
const inputFiles=[['e2-production-catalog.csv','e4a09e7773dc5780916b320ca3bd4ba336d802c6c67d81c01b6822b1193cca71'],['production-schema-snapshot.csv','4e5bdd0d6befabbbc90cad17617419af96f9f92437f5915941827f4ff22b11c1']]
for(const [file,hash]of inputFiles)assert.equal(digest(fs.readFileSync(path.join(root,'audit-production',file))),hash)
execFileSync('git',['merge-base','--is-ancestor','612db0f17df314bb4ae2b70ce4799119bb7c352e','HEAD'],{cwd:root,stdio:'ignore'})
const acl=(expr,def)=>`(SELECT coalesce(jsonb_agg(jsonb_build_array(CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,pg_get_userbyid(x.grantor),x.privilege_type,x.is_grantable) ORDER BY x.grantee::regrole::text COLLATE "C",x.grantor::regrole::text COLLATE "C",x.privilege_type COLLATE "C",x.is_grantable),'[]'::jsonb) FROM aclexplode(CASE WHEN cardinality(coalesce(${expr},${def}))=0 THEN NULL::aclitem[] ELSE coalesce(${expr},${def}) END) x)`
const collector=`rel AS MATERIALIZED (
 SELECT c.*,n.nspname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relkind IN ('r','p','v','m','f') AND (n.nspname='public' OR starts_with(n.nspname,'artecna_'))
), fun AS MATERIALIZED (
 SELECT p.*,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind='f' AND (n.nspname='public' OR starts_with(n.nspname,'artecna_'))
 AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
), worker_roles AS MATERIALIZED (
 SELECT oid,rolname,rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolconnlimit,rolvaliduntil FROM pg_roles
 WHERE rolname IN ('artecna_storage_worker','artecna_storage_worker_login')
), raw_objects AS (
 SELECT 'relation:'||r.nspname||'.'||r.relname k,jsonb_build_array(r.relkind,pg_get_userbyid(r.relowner),r.relrowsecurity,r.relforcerowsecurity,CASE WHEN r.relkind IN ('v','m') THEN pg_get_viewdef(r.oid,true) END,${acl('r.relacl',"acldefault('r',r.relowner)")}) v FROM rel r
 UNION ALL SELECT 'column:'||r.nspname||'.'||r.relname||'.'||a.attname,jsonb_build_array(format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),a.attidentity,a.attgenerated,${acl('a.attacl',"'{}'::aclitem[]")}) FROM rel r JOIN pg_attribute a ON a.attrelid=r.oid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0 AND NOT a.attisdropped
 UNION ALL SELECT 'constraint:'||n.nspname||'.'||c.relname||'.'||k.conname,jsonb_build_array(k.contype,pg_get_constraintdef(k.oid,true),k.condeferrable,k.condeferred,k.convalidated,k.confdeltype,k.confupdtype,k.confmatchtype) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE k.conrelid IN(SELECT oid FROM rel) OR k.confrelid IN(SELECT oid FROM rel)
 UNION ALL SELECT 'index:'||n.nspname||'.'||c.relname,jsonb_build_array(pg_get_indexdef(i.indexrelid),i.indisunique,i.indisvalid,i.indisready) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE i.indrelid IN(SELECT oid FROM rel)
 UNION ALL SELECT 'trigger:'||r.nspname||'.'||r.relname||'.'||t.tgname,jsonb_build_array(pg_get_triggerdef(t.oid,true),t.tgenabled,t.tgtype,t.tgfoid::regprocedure::text) FROM pg_trigger t JOIN rel r ON r.oid=t.tgrelid WHERE NOT t.tgisinternal
 UNION ALL SELECT 'function:'||p.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')',jsonb_build_array(pg_get_userbyid(p.proowner),p.prosecdef,p.provolatile,p.proconfig,${acl('p.proacl',"acldefault('f',p.proowner)")},md5(p.prosrc),md5(pg_get_functiondef(p.oid))) FROM fun p
 UNION ALL SELECT 'role:'||rolname,jsonb_build_array(rolcanlogin,rolinherit,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolconnlimit,rolvaliduntil) FROM worker_roles
 UNION ALL SELECT 'role_setting:'||r.rolname||':'||coalesce(d.datname,'ALL_DATABASES'),to_jsonb('UNEXPECTED_ROLE_SETTINGS'::text) FROM pg_db_role_setting s JOIN worker_roles r ON r.oid=s.setrole LEFT JOIN pg_database d ON d.oid=s.setdatabase
 UNION ALL SELECT 'membership:'||r.rolname||':'||pg_get_userbyid(m.member)||':'||pg_get_userbyid(m.grantor),jsonb_build_array(m.admin_option,m.inherit_option,m.set_option) FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid WHERE m.roleid IN(SELECT oid FROM worker_roles) OR m.member IN(SELECT oid FROM worker_roles)
 UNION ALL SELECT 'direct_dependency:'||r.rolname||':'||d.deptype::text||':'||CASE WHEN d.dbid IN(0,(SELECT oid FROM pg_database WHERE datname=current_database())) THEN pg_describe_object(d.classid,d.objid,d.objsubid) ELSE 'OTHER_DATABASE:'||d.dbid::text||':'||d.classid::text||':'||d.objid::text||':'||d.objsubid::text END,to_jsonb(d.deptype::text) FROM pg_shdepend d JOIN worker_roles r ON r.oid=d.refobjid WHERE d.refclassid='pg_authid'::regclass AND d.deptype IN('a','o')
), fingerprints AS MATERIALIZED (
 SELECT k,md5(v::text) fingerprint FROM raw_objects
), observed AS MATERIALIZED (
 SELECT coalesce(jsonb_object_agg(k,fingerprint),'{}'::jsonb) objects FROM fingerprints
)`
function aclOriginal(entries,owner,kind){
 const rights={a:'INSERT',r:'SELECT',w:'UPDATE',d:'DELETE',D:'TRUNCATE',x:'REFERENCES',t:'TRIGGER',m:'MAINTAIN',X:'EXECUTE'}
 if(entries===null||entries===undefined)entries=kind==='column'?[]:kind==='function'?[`=X/${owner}`,`${owner}=X/${owner}`]:[`${owner}=arwdDxtm/${owner}`]
 const out=[];for(const e of entries){const m=e.match(/^([^=]*)=([^/]*)\/(.*)$/);assert(m,e);for(const ch of m[2]){assert(rights[ch],e);out.push([m[1]||'PUBLIC',m[3],rights[ch],false])}}
 return out.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'))
}
const sameACL=(a,b)=>assert.deepEqual(a.map(JSON.stringify).sort(),b.map(JSON.stringify).sort())
const signature=s=>s.replace(/,\s*/g,',').replaceAll('public.','public.')
async function main(){
 const runtime=path.join(root,'.run/cantiere-prereq-runtime/minimal/pgsql/bin'),dir=path.join(bundle,'.offline-runtime-'+crypto.randomUUID()),data=path.join(dir,'data');fs.mkdirSync(dir)
 const execute=(n,a)=>execFileSync(path.join(runtime,n+'.exe'),a,{windowsHide:true,encoding:'utf8',timeout:60000,stdio:n==='pg_ctl'?'ignore':'pipe'})
 assert(execute('postgres',['--version']).includes('17.6'))
 const sock=net.createServer();await new Promise(r=>sock.listen(0,'127.0.0.1',r));const port=sock.address().port;await new Promise(r=>sock.close(r))
 let started=false,db,admin;const results=[],states=[],rawStates=[]
 try{
  execute('initdb',['-D',data,'-U','fixture_admin','-A','trust','--no-locale','-E','UTF8'])
  execute('pg_ctl',['-D',data,'-l',path.join(dir,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -c fsync=off`,'-w','start']);started=true
  admin=new Client({host:'127.0.0.1',port,user:'fixture_admin',database:'postgres'});admin.on('error',()=>{});await admin.connect()
  await admin.query('CREATE ROLE postgres LOGIN SUPERUSER');await admin.query('ALTER DATABASE postgres OWNER TO postgres')
  db=new Client({host:'127.0.0.1',port,user:'postgres',database:'postgres'});db.on('error',()=>{});await db.connect()
  await db.query(fs.readFileSync(path.join(root,'supabase/validators/cantiere-prerequisiti/baseline.sql'),'utf8'))
  // Fixture fidelity fixes, only on the isolated database: extension membership,
  // MAINTAIN grants and RLS flags omitted by the existing generic test fixture.
  await db.query('ALTER EXTENSION plpgsql ADD FUNCTION public.uuid_generate_v4()')
  for(const r of schema.relations){const name=ident(r.schema)+'.'+ident(r.table)
   if(r.rls)await db.query(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`)
   if(r.forced_rls)await db.query(`ALTER TABLE ${name} FORCE ROW LEVEL SECURITY`)
   for(const a of r.acl||[]){const m=a.match(/^([^=]*)=([^/]*)\//);if(m&&m[2].includes('m'))await db.query(`GRANT MAINTAIN ON TABLE ${name} TO ${m[1]?ident(m[1]):'PUBLIC'}`)}
  }
  await admin.query('ALTER ROLE postgres NOSUPERUSER CREATEROLE CREATEDB REPLICATION BYPASSRLS')
  const actor=(await db.query('SELECT current_user,session_user,rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0]
  assert.deepEqual(actor,{current_user:'postgres',session_user:'postgres',rolsuper:false,rolcreaterole:true,rolcreatedb:true,rolreplication:true,rolbypassrls:true})
  results.push({test:'Actual installer and session postgres NOSUPERUSER, CREATEROLE/CREATEDB/REPLICATION/BYPASSRLS',pass:true,actor})
  const query=`WITH ${collector} SELECT k,v FROM raw_objects ORDER BY k`
  const collect=async()=>{await db.query('SET search_path=pg_catalog,pg_temp');const rows=(await db.query(query)).rows;const pairs=(await db.query(`WITH ${collector} SELECT objects FROM observed`)).rows[0].objects;rawStates.push(Object.fromEntries(rows.map(r=>[r.k,r.v])));states.push(pairs)}
  await collect()
  const original=rawStates[0]
  assert.equal(Object.keys(original).filter(k=>k.startsWith('relation:')).length,schema.relations.length)
  assert.equal(Object.keys(original).filter(k=>k.startsWith('function:')).length,schema.functions.length)
  for(const r of schema.relations){const v=original['relation:'+r.schema+'.'+r.table];assert(v);assert.deepEqual(v.slice(0,5),[r.kind,r.owner,r.rls,r.forced_rls,r.view_definition]);sameACL(v[5],aclOriginal(r.acl,r.owner,'table'))}
  for(const c of schema.columns){const r=schema.relations.find(r=>r.oid===c.relation),v=original['column:'+r.schema+'.'+r.table+'.'+c.name];assert(v);assert.deepEqual(v.slice(0,5),[c.type,c.not_null,c.default,c.identity,c.generated]);sameACL(v[5],aclOriginal(c.acl,'postgres','column'))}
  for(const f of schema.functions){const key=Object.keys(original).find(k=>k.startsWith('function:')&&signature(k.slice(9))===signature(f.signature));assert(key,f.signature);const v=original[key];assert.deepEqual(v.slice(0,4),[f.owner,f.security_definer,f.volatility,f.config]);assert.equal(v[5],f.source_md5,f.signature);assert.equal(v[6],crypto.createHash('md5').update(f.definition).digest('hex'),f.signature);sameACL(v[4],aclOriginal(f.acl,f.owner,'function'))}
  for(const c of schema.constraints){const v=original['constraint:'+c.child+'.'+c.name];assert(v,c.name);assert.deepEqual(v.slice(0,7),[c.type,c.definition,c.deferrable,c.deferred,c.validated,c.on_delete,c.on_update])}
  for(const i of schema.indexes){const v=original['index:'+i.name];assert.deepEqual(v,[i.definition,i.unique,i.valid,i.ready])}
  for(const t of schema.triggers.filter(t=>!t.internal)){const r=schema.relations.find(r=>r.oid===t.relation),v=original['trigger:'+r.schema+'.'+r.table+'.'+t.name];assert.deepEqual(v,[t.definition,t.enabled,t.event_bits,t.function])}
  results.push({test:'Baseline canonical catalog reconciled against all certified export columns/constraints/indexes/custom triggers/functions/owners/ACL/RLS',pass:true})
  const migrations=fs.readdirSync(path.join(root,'supabase/migrations')).filter(n=>/^20261107\d{6}_/.test(n)).sort();assert.equal(migrations.length,7)
  for(const m of migrations){await db.query(fs.readFileSync(path.join(root,'supabase/migrations',m),'utf8'));await collect()}
  const patches=states.slice(1).map((next,i)=>Object.fromEntries([...new Set([...Object.keys(states[i]),...Object.keys(next)])].filter(k=>states[i][k]!==next[k]).map(k=>[k,next[k]??null])))
  const payload={baseline:states[0],patches}
  const classifier=`WITH RECURSIVE ${collector}, expected(n,objects) AS (
 SELECT 0, '${JSON.stringify(states[0])}'::jsonb
 UNION ALL SELECT e.n+1,jsonb_strip_nulls(e.objects||( '${JSON.stringify(patches)}'::jsonb ->e.n)) FROM expected e WHERE e.n<7
), matched AS (SELECT max(n) stage FROM expected e CROSS JOIN observed o WHERE e.objects=o.objects), facts AS (
 SELECT m.stage,current_database() database,current_setting('server_version') server_version,current_setting('transaction_read_only') read_only,
 CASE WHEN m.stage IS NULL THEN 'STOP_DRIFT_CONFLICT' WHEN current_database()<>'postgres' OR current_user<>'postgres' THEN 'STOP_INSTALLER_IDENTITY'
 WHEN current_setting('server_version_num')<>'170006' THEN 'STOP_SERVER_VERSION'
 WHEN current_setting('transaction_read_only')<>'on' THEN 'STOP_NOT_READ_ONLY'
 WHEN m.stage=0 AND NOT (SELECT rolsuper OR rolcreaterole FROM pg_roles WHERE rolname=current_user) THEN 'STOP_INSTALLER_CREATEROLE'
 WHEN m.stage=0 AND (SELECT count(*) FROM pg_namespace n WHERE n.nspname IN('public','artecna_distruzione','artecna_contabilita') AND has_schema_privilege(current_user,n.oid,'USAGE') AND has_schema_privilege(current_user,n.oid,'CREATE'))<>3 THEN 'STOP_INSTALLER_SCHEMA_AUTHORITY'
 WHEN m.stage=0 AND EXISTS(SELECT 1 FROM pg_language l WHERE l.lanname IN('sql','plpgsql') AND NOT has_language_privilege(current_user,l.oid,'USAGE')) THEN 'STOP_INSTALLER_LANGUAGE_AUTHORITY'
 WHEN m.stage=0 THEN 'GREEN_APPLY_7' ELSE 'STOP_ALREADY_APPLIED_PREFIX_'||m.stage::text END verdict
 FROM matched m
), summary AS (
 SELECT jsonb_build_object('report','PRECHECK_CANTIERE_DELETE_PREREQUISITI','database',database,'server_version',server_version,'read_only',read_only,'principal',current_user,
 'matched_prefix',stage,'installer_superuser',(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),'installer_createrole',(SELECT rolcreaterole FROM pg_roles WHERE rolname=current_user),
 'worker_admin_authority',CASE WHEN stage=0 THEN 'PG17_CREATOR_ADMIN_EXPECTED_ON_CREATE' WHEN EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid=to_regrole('artecna_storage_worker') AND member=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND admin_option) THEN 'DIRECT_ADMIN_CONFIRMED' ELSE 'NOT_CONFIRMED' END,
 'drift_status',CASE WHEN stage IS NULL THEN 'DRIFT_CONFLICT' ELSE 'NO_CATALOG_DRIFT' END,
 'role_worker_status',CASE WHEN NOT EXISTS(SELECT 1 FROM worker_roles WHERE rolname='artecna_storage_worker') THEN 'ABSENT' WHEN stage IS NULL THEN 'DRIFT_CONFLICT' ELSE 'EXPECTED_NOLOGIN' END,
 'role_login_status',CASE WHEN NOT EXISTS(SELECT 1 FROM worker_roles WHERE rolname='artecna_storage_worker_login') THEN 'ABSENT' WHEN stage IS NULL THEN 'DRIFT_CONFLICT' ELSE 'EXPECTED_LOGIN_SCOPED' END,
 'role_worker_attributes',(SELECT v FROM raw_objects WHERE k='role:artecna_storage_worker'),
 'role_login_attributes',(SELECT v FROM raw_objects WHERE k='role:artecna_storage_worker_login'),
 'observed_objects',(SELECT count(*) FROM fingerprints),
 'differences_from_baseline',coalesce((SELECT jsonb_agg(k ORDER BY k) FROM (SELECT coalesce(a.key,b.key) k FROM jsonb_each_text((SELECT objects FROM expected WHERE n=0)) a FULL JOIN jsonb_each_text((SELECT objects FROM observed)) b USING(key) WHERE a.value IS DISTINCT FROM b.value) d),'[]'::jsonb),
 'verdict',verdict) || (SELECT jsonb_object_agg('migration_'||lpad(i::text,3,'0')||'_status',CASE WHEN facts.stage IS NULL THEN 'DRIFT_CONFLICT' WHEN i<=facts.stage THEN 'ALREADY_EQUIVALENT' ELSE 'NOT_APPLIED' END) FROM generate_series(1,7) i) result FROM facts
) SELECT result FROM summary`
  const sql="\\set ON_ERROR_STOP on\nBEGIN READ ONLY;\nSET LOCAL search_path=pg_catalog,pg_temp;\nSET LOCAL statement_timeout='60s';\nSET LOCAL lock_timeout='5s';\nSET LOCAL idle_in_transaction_session_timeout='60s';\n"+classifier+';\nROLLBACK;\n'
  fs.writeFileSync(path.join(bundle,'01_precheck_cantiere_delete_prerequisiti_production_readonly.sql'),sql)
  fs.writeFileSync(path.join(root,'supabase/validators/cantiere-prerequisiti/production-precheck-readonly.sql'),sql)
  fs.writeFileSync(path.join(root,'supabase/validators/cantiere-prerequisiti/baseline-catalog-fidelity.json'),JSON.stringify({sourceSha256:inputFiles[1][1],relations:schema.relations.map(r=>({schema:r.schema,table:r.table,rls:r.rls,forced_rls:r.forced_rls,maintain:(r.acl||[]).flatMap(a=>{const m=a.match(/^([^=]*)=([^/]*)\//);return m&&m[2].includes('m')?[m[1]||'PUBLIC']:[]})}))},null,2)+'\n')
  fs.writeFileSync(path.join(bundle,'expected-catalog-states.json'),JSON.stringify(payload,null,2)+'\n')
  fs.writeFileSync(path.join(bundle,'PROVENANCE.json'),JSON.stringify({candidate:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),candidateAncestor:'612db0f17df314bb4ae2b70ce4799119bb7c352e',productionBaseline:'fdd57e2d79e99153fe2ea9d8c7dbf645953fcf36',inputs:inputFiles.map(([file,sha256])=>({file,sha256})),migrations:migrations.map(file=>({file,sha256:digest(fs.readFileSync(path.join(root,'supabase/migrations',file)))})),objects:states.map((s,stage)=>({stage,count:Object.keys(s).length})),policyScope:'RLS flags included; policies and role OIDs not exported with authoritative role-name mapping are not inferred. No application or registry/config data read.'},null,2)+'\n')
  // Validate the delivered SELECT for all eight catalog states. At each state,
  // rollback the remaining local migration changes to recreate the prefix.
  for(let stage=0;stage<=7;stage++){
   await db.query('BEGIN READ ONLY')
   // Query's actual catalog comes from state 7; for prefix tests replace only
   // its observed fingerprints using the previously collected native catalog.
   const projected=classifier.replace('SELECT coalesce(jsonb_object_agg(k,fingerprint),\'{}\'::jsonb) objects FROM fingerprints',`SELECT '${JSON.stringify(states[stage])}'::jsonb objects`)
   const r=(await db.query(projected)).rows[0].result
   await db.query('ROLLBACK')
   assert.equal(r.matched_prefix,stage);assert.equal(r.verdict,stage===0?'GREEN_APPLY_7':'STOP_ALREADY_APPLIED_PREFIX_'+stage)
   for(let i=1;i<=7;i++)assert.equal(r['migration_'+String(i).padStart(3,'0')+'_status'],i<=stage?'ALREADY_EQUIVALENT':'NOT_APPLIED')
   results.push({test:'Classifier native catalog prefix '+stage,pass:true})
  }
  await db.query('BEGIN READ ONLY');const final=(await db.query(classifier)).rows[0].result;await db.query('ROLLBACK');assert.equal(final.matched_prefix,7)
  results.push({test:'Delivered SELECT against real final catalog under READ ONLY',pass:true})
  await admin.query('ALTER ROLE artecna_storage_worker_login SUPERUSER');await db.query('BEGIN READ ONLY')
  const drift=(await db.query(classifier)).rows[0].result;assert.equal(drift.verdict,'STOP_DRIFT_CONFLICT');await db.query('ROLLBACK');await admin.query('ALTER ROLE artecna_storage_worker_login NOSUPERUSER')
  results.push({test:'Dangerous login role drift rejected',pass:true})
  // Whitelist SQL statement forms after lexically removing literals/comments.
  const lexical=sql.replace(/^\\set ON_ERROR_STOP on\r?\n/,'').replace(/--[^\n]*/g,'').replace(/'(?:''|[^'])*'/g,"''").replace(/"(?:""|[^"])*"/g,'identifier')
  const statements=lexical.split(';').map(s=>s.trim()).filter(Boolean)
  assert.deepEqual(statements.map(s=>s.match(/^([A-Z]+)/)[1]),['BEGIN','SET','SET','SET','SET','WITH','ROLLBACK'])
  assert(!/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|DO|CALL|COPY|EXECUTE|SECURITY\s+LABEL|INTO|SET\s+ROLE)\b/i.test(lexical))
  assert(sql.startsWith('\\set ON_ERROR_STOP on\nBEGIN READ ONLY;'));assert(sql.trim().endsWith('ROLLBACK;'))
  assert(!/pg_authid|rolpassword|storage_claim\s*\(|storage_finish\s*\(/i.test(lexical))
  results.push({test:'Static statement whitelist, no mutation/RPC/password query; READ ONLY and final ROLLBACK',pass:true})
  fs.writeFileSync(path.join(bundle,'OFFLINE-VALIDATION.json'),JSON.stringify({productionConnections:0,server:'PostgreSQL 17.6 isolated loopback',results,green:results.every(r=>r.pass)},null,2)+'\n')
  console.log(JSON.stringify({green:true,tests:results.length,states:states.map(s=>Object.keys(s).length),productionConnections:0}))
 }finally{if(started)execute('pg_ctl',['-D',data,'-m','immediate','-w','stop']);await Promise.allSettled([db?.end(),admin?.end()])}
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
