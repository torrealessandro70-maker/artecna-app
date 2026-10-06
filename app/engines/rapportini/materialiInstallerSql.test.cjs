// M2.3 installer: PostgreSQL 17.6 reale e isolato, nessun accesso remoto.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {spawnSync}=require('node:child_process'),{randomUUID,createHash}=require('node:crypto'),{Client}=require('pg');
const {fixture,A,OP,TOKEN}=require('./fixtureStep3.cjs');
const read=n=>fs.readFileSync(path.resolve(__dirname,'../../../supabase/migrations',n),'utf8');
const sql=read('20261006_rapportino_materiali_writer.sql');
const transition=/DO \$installer_prepare\$[\s\S]*?\$installer_restore\$;/;
const oldTransition='ALTER FUNCTION artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb) OWNER TO artecna_rapportini_rpc;';
const empty=()=>({nuove:[],aggiornate:[],rimosse:[]});
const memberQuery=`SELECT roleid,member,grantor,admin_option,inherit_option,set_option FROM pg_auth_members ORDER BY roleid,member,grantor`;
const schemaQuery=`SELECT nspowner,nspacl FROM pg_namespace WHERE nspname='artecna_rapportini'`;
const hashesQuery=`SELECT oid,proowner,prosecdef,proconfig,proacl,encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex') hash FROM pg_proc WHERE oid IN ('public.salva_rapportino_con_prestazioni(jsonb,text)'::regprocedure,'artecna_rapportini.materiali_fail_closed()'::regprocedure,'artecna_rapportini.applica_prestazioni_rapportino(jsonb)'::regprocedure) ORDER BY oid`;

test('M2.3 installer: nessun cambiamento dei corpi runtime',()=>{
 const pre=read('20261006_rapportino_materiali_writer.sql');
 for(const h of ['c97f063e9aff6ca5dd0d3772e0a343de8a9a14763662038bdc770cfe4246880c','69f6e5258de386726ece3a71108ea57b3ab299f47ce71922618be984495d6a9f'])assert(pre.includes(h));
 assert.match(sql,/WITH INHERIT FALSE GRANTED BY postgres/);
 assert.match(sql,/WITH SET TRUE GRANTED BY postgres/);
 assert.match(sql,/REVOKE artecna_rapportini_rpc FROM postgres GRANTED BY postgres RESTRICT/);
 assert(!/WITH INHERIT TRUE/.test(sql));
 const a=sql.indexOf('CREATE FUNCTION artecna_rapportini.applica_materiali_contratto_due'),b=sql.indexOf('$fn$;',a),body=sql.slice(a,b).split('AS $fn$')[1];
 assert.equal(createHash('sha256').update(body.replace(/\r\n/g,'\n')).digest('hex'),'c97f063e9aff6ca5dd0d3772e0a343de8a9a14763662038bdc770cfe4246880c');
 assert(!body.includes('SET ROLE'));
});

test('M2.3: installer non-superuser replica Production su PostgreSQL 17.6',async t=>{
 const bin=path.join(os.tmpdir(),'artecna-postgres17-minimal-runtime/pgsql/bin');
 assert(fs.existsSync(path.join(bin,'initdb.exe')),'Runtime PostgreSQL 17.6 richiesto, nessun fallback superuser/18');
 const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'artecna-m23-installer-'));
 const ctl=(exe,args)=>{const r=spawnSync(path.join(bin,exe),args,{stdio:'ignore',windowsHide:true,timeout:30000});assert.equal(r.status,0,'Runtime PostgreSQL 17.6 locale');};
 const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const clients=[];let started=false,supervisor,serial=0;
 const connect=async(user,database='postgres')=>{const c=new Client({host:'127.0.0.1',port,database,user,connectionTimeoutMillis:5000});await c.connect();clients.push(c);return c;};
 const q=async(c,s,p)=>(await c.query(s,p)).rows;
 async function laboratory(f){
   const database='installer_'+(++serial);
   await supervisor.query('ALTER ROLE postgres SUPERUSER');
   await supervisor.query(`CREATE DATABASE ${database} OWNER postgres`);
   const installer=await connect('postgres',database),admin=await connect('supabase_admin',database),db={exec:s=>installer.query(s),query:(s,p)=>installer.query(s,p)};
   try{
     await db.exec(serial===1?fixture:fixture.replace(/CREATE ROLE (authenticated|anon|service_role) NOLOGIN;/g,''));
     await db.exec('ALTER TABLE public.rapportini ADD COLUMN costo_materiali text');
     for(const n of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql','20261003_rapportino_backend_pooler.sql','20261004_rapportino_lettura_portale.sql','20261006_rapportino_materiali_schema.sql'])await db.exec(read(n));
     await installer.query('SELECT public.crea_sessione_rapportino($1,$2)',['1234',TOKEN]);
     await admin.query('GRANT artecna_rapportini_rpc TO postgres WITH ADMIN TRUE GRANTED BY supabase_admin');
     await admin.query('GRANT artecna_rapportini_rpc TO postgres WITH INHERIT FALSE GRANTED BY supabase_admin');
     await admin.query('GRANT artecna_rapportini_rpc TO postgres WITH SET FALSE GRANTED BY supabase_admin');
     await supervisor.query('ALTER ROLE postgres NOSUPERUSER INHERIT CREATEROLE CREATEDB BYPASSRLS REPLICATION');
     const role=(await q(installer,"SELECT current_user,session_user,rolsuper,rolcreaterole,rolinherit FROM pg_roles WHERE rolname=current_user"))[0];
     assert.deepEqual(role,{current_user:'postgres',session_user:'postgres',rolsuper:false,rolcreaterole:true,rolinherit:true});
     assert.deepEqual((await q(installer,"SELECT pg_has_role('postgres','artecna_rapportini_rpc','MEMBER') member,pg_has_role('postgres','artecna_rapportini_rpc','USAGE') usage,pg_has_role('postgres','artecna_rapportini_rpc','SET') set"))[0],{member:true,usage:false,set:false});
     await f({installer,admin,db});
   }finally{
     await installer.query('ROLLBACK').catch(()=>{});await installer.end();await admin.end();
     await supervisor.query(`DROP DATABASE ${database} WITH (FORCE)`);
     await supervisor.query('REVOKE ALL ON DATABASE postgres FROM artecna_rapportini_backend');
     await supervisor.query('DROP ROLE artecna_rapportini_backend');await supervisor.query('DROP ROLE artecna_rapportini_rpc');
   }
 }
 const snapshot=async c=>({members:await q(c,memberQuery),schema:await q(c,schemaQuery),functions:await q(c,hashesQuery)});
 const assertRollback=async(c,before)=>{
   assert.deepEqual(await snapshot(c),before);
   const missing=await q(c,"SELECT to_regprocedure(f) function FROM unnest(ARRAY['artecna_rapportini.salva_contratto_uno(jsonb,text)','artecna_rapportini.salva_contratto_due(jsonb,text)','artecna_rapportini.applica_prestazioni_contratto_due(jsonb)','artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb)']) f");assert(missing.every(r=>r.function===null));
   assert.equal((await q(c,"SELECT count(*)::integer n FROM pg_policy WHERE polrelid='public.rapportino_materiali'::regclass"))[0].n,0);
   assert.equal((await q(c,"SELECT current_user u"))[0].u,'postgres');
   assert.equal((await q(c,"SELECT has_table_privilege('artecna_rapportini_rpc','public.rapportino_materiali','SELECT,INSERT,UPDATE,DELETE') p"))[0].p,false);
 };
 try{
   ctl('initdb.exe',['-D',scratch,'-U','supabase_admin','--auth=trust','--encoding=UTF8','--locale=C']);
   ctl('pg_ctl.exe',['-D',scratch,'-l',path.join(scratch,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start']);started=true;
   supervisor=await connect('supabase_admin');
   assert.equal((await q(supervisor,"SELECT current_setting('server_version') v"))[0].v,'17.6');
   await supervisor.query('CREATE ROLE postgres LOGIN SUPERUSER INHERIT CREATEROLE CREATEDB BYPASSRLS REPLICATION');
   await t.test('senza fix: stesso 42501 SET ROLE Production, rollback completo',()=>laboratory(async({installer})=>{const before=await snapshot(installer);await assert.rejects(()=>installer.query(sql.replace(transition,oldTransition)),e=>e.code==='42501'&&e.message==='must be able to SET ROLE "artecna_rapportini_rpc"');await installer.query('ROLLBACK');await assertRollback(installer,before);}));
   await t.test('fix installabile: grant provider intatto, nessun SET/INHERIT/CREATE residuo e runtime RPC',()=>laboratory(async({installer,db})=>{
     const before=await snapshot(installer);await installer.query(sql);
     assert.deepEqual(await q(installer,memberQuery),before.members);assert.deepEqual(await q(installer,schemaQuery),before.schema);
     const member=(await q(installer,"SELECT grantor::regrole::text grantor,admin_option,inherit_option,set_option FROM pg_auth_members WHERE roleid='artecna_rapportini_rpc'::regrole AND member='postgres'::regrole"))[0];assert.deepEqual(member,{grantor:'supabase_admin',admin_option:true,inherit_option:false,set_option:false});
     assert.equal((await q(installer,"SELECT pg_has_role('postgres','artecna_rapportini_rpc','SET') p"))[0].p,false);
     assert.deepEqual((await q(installer,"SELECT has_schema_privilege('artecna_rapportini_rpc','artecna_rapportini','USAGE') usage,has_schema_privilege('artecna_rapportini_rpc','artecna_rapportini','CREATE') can_create"))[0],{usage:true,can_create:false});
     assert.deepEqual((await q(installer,"SELECT proowner::regrole::text owner,prosecdef FROM pg_proc WHERE oid='artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb)'::regprocedure"))[0],{owner:'artecna_rapportini_rpc',prosecdef:true});
     // Osservatore solo nel laboratorio: rileva l'identità dopo le guardie reali.
     await installer.query(`CREATE TABLE public.test_materiali_identity(ruolo text); GRANT INSERT ON public.test_materiali_identity TO artecna_rapportini_rpc;
       CREATE FUNCTION public.test_materiali_identity() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO pg_catalog,pg_temp AS $$ BEGIN INSERT INTO public.test_materiali_identity VALUES(current_user); RETURN NEW; END; $$;
       CREATE TRIGGER test_materiali_identity AFTER INSERT ON public.rapportino_materiali FOR EACH ROW EXECUTE FUNCTION public.test_materiali_identity()`);
     const payload={versione_contratto:2,richiesta_id:randomUUID(),rapportino_id:null,revisione_attesa:null,cantiere_id:A,data:'2026-10-06',documento:{note:'Lavori'},prestazioni:empty(),materiali:{...empty(),nuove:[{materiale_id:null,chiave_client:randomUUID(),descrizione:'Collante',unita_misura:'sacco',quantita:'1.000000',costo_unitario:null,note:''}]}};
     const write=async()=> (await q(installer,'SELECT public.salva_rapportino_con_prestazioni($1::jsonb,$2) v',[JSON.stringify(payload),TOKEN]))[0].v;
     const result=await write();assert.equal(result.materiali.length,1);assert.deepEqual(await write(),result);
     assert.deepEqual(await q(installer,'SELECT ruolo FROM public.test_materiali_identity'),[{ruolo:'artecna_rapportini_rpc'}]);
     await assert.rejects(()=>installer.query("UPDATE public.rapportino_materiali SET note='Diretto'"),e=>e.code==='PR403');
     for(const role of ['anon','authenticated','service_role','artecna_rapportini_backend']){
       assert.equal((await q(installer,"SELECT has_table_privilege($1,'public.rapportino_materiali','SELECT,INSERT,UPDATE,DELETE') OR has_any_column_privilege($1,'public.rapportino_materiali','SELECT,INSERT,UPDATE') p",[role]))[0].p,false);
       assert.equal((await q(installer,"SELECT has_function_privilege($1,'artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb)','EXECUTE') p",[role]))[0].p,false);
     }
   }));
   const cases=[
     ['errore dopo grant temporanei',sql.replace('$installer_prepare$;','$installer_prepare$;\nDO $fault$ BEGIN IF NOT pg_has_role(\'postgres\',\'artecna_rapportini_rpc\',\'SET\') OR NOT has_schema_privilege(\'artecna_rapportini_rpc\',\'artecna_rapportini\',\'CREATE\') THEN RAISE EXCEPTION \'Grant temporanei mancanti\'; END IF; RAISE EXCEPTION \'Errore fixture dopo prepare\'; END; $fault$;'),'Errore fixture dopo prepare'],
     ['errore con SET LOCAL ROLE RPC attivo',sql.replace('DO $materiali_acl$',"DO $fault$ BEGIN IF current_user<>'artecna_rapportini_rpc' THEN RAISE EXCEPTION 'Ruolo fixture inatteso'; END IF; RAISE EXCEPTION 'Errore fixture durante ACL'; END; $fault$;\nDO $materiali_acl$"),'Errore fixture durante ACL'],
     ['post-check runtime fallito',sql.replace('DO $postcheck$',"ALTER FUNCTION public.salva_rapportino_con_prestazioni(jsonb,text) SECURITY INVOKER;\nDO $postcheck$"),'Writer metadata/fingerprint divergenti'],
     ['post-check SET residuo',sql.replace('DO $installer_postcheck$','GRANT artecna_rapportini_rpc TO postgres WITH INHERIT FALSE GRANTED BY postgres;\nGRANT artecna_rapportini_rpc TO postgres WITH SET TRUE GRANTED BY postgres;\nDO $installer_postcheck$'),'Autorizzazioni temporanee installer non ripristinate'],
     ['post-check CREATE residuo',sql.replace('DO $installer_postcheck$','GRANT CREATE ON SCHEMA artecna_rapportini TO artecna_rapportini_rpc;\nDO $installer_postcheck$'),'Autorizzazioni temporanee installer non ripristinate']
   ];
   for(const [name,candidate,message] of cases)await t.test(name+': rollback membership/schema/DDL/ACL',()=>laboratory(async({installer})=>{const before=await snapshot(installer);await assert.rejects(()=>installer.query(candidate),e=>e.code==='P0001'&&e.message===message);await installer.query('ROLLBACK');await assertRollback(installer,before);}));
 }finally{
   await Promise.allSettled(clients.map(c=>c.end()));if(started)ctl('pg_ctl.exe',['-D',scratch,'-m','immediate','-w','stop']);
   const resolved=path.resolve(scratch),root=path.resolve(os.tmpdir())+path.sep;if(!resolved.startsWith(root)||!path.basename(resolved).startsWith('artecna-m23-installer-'))throw Error('Cleanup laboratorio fuori scope');fs.rmSync(resolved,{recursive:true,force:true});
 }
});
