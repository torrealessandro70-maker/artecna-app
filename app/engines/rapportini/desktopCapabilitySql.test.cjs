// PostgreSQL 17.5 via PGlite, isolated database. Never connects to a project DB.
/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto')
const {fixture,A,B,RAP,OP,USER,TOKEN}=require('./fixtureStep3.cjs')
const production=require('./f3c3Production.fixture.json')
const read=n=>fs.readFileSync(path.resolve(__dirname,'../../../supabase/migrations',n),'utf8').replaceAll('\r\n','\n')
const migration=read('20261106_rapportino_desktop_capability.sql')
const quote=s=>'"'+s.replaceAll('"','""')+'"'
function definition(file,name){const s=read(file),start=s.indexOf('CREATE FUNCTION '+name+'(');assert(start>=0,name);const tail=s.slice(start),end=tail.indexOf('$fn$;',tail.indexOf('$fn$')+5);return tail.slice(0,end+6)}
test('Desktop capability: SQL reale, ACL, core mobile e reader 1/2',async t=>{
 const {PGlite}=require('@electric-sql/pglite'),{uuid_ossp}=require('@electric-sql/pglite/contrib/uuid_ossp')
 const db=new PGlite({extensions:{uuid_ossp}})
 const clients=[];let admin,installer,backend
 const connect=async user=>({async query(sql,args){
  await db.exec('RESET ROLE; SET SESSION AUTHORIZATION '+quote(user)+';'+(user==='authenticated'?' SET ROLE authenticated;':''))
  if(args!==undefined)return db.query(sql,args)
  const results=await db.exec(sql);return results.at(-1)||{rows:[]}
 },async end(){}})
 const q=async(c,sql,args=[])=>(await c.query(sql,args)).rows
 const reject=(fn,code)=>assert.rejects(fn,e=>e.code===code)
 try{
  await db.exec('CREATE ROLE supabase_admin LOGIN SUPERUSER');admin=await connect('supabase_admin')
  installer=await connect('postgres');await installer.query(fixture)
  const photo=production.tables['public.foto_cantiere']
  await installer.query(`CREATE SCHEMA extensions; CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
   CREATE TABLE public.foto_cantiere(${photo.columns.map(c=>quote(c.name)+' '+c.type+(c.not_null?' NOT NULL':'')+(c.default?' DEFAULT '+(c.name==='id'?'extensions.uuid_generate_v4()':c.default):'')).join(',')});
   ${photo.constraints.map(c=>'ALTER TABLE public.foto_cantiere ADD CONSTRAINT '+quote(c.name)+' '+c.definition+';').join('\n')}
   CREATE ROLE artecna_cantieri_delete_rpc NOLOGIN;
   REVOKE ALL ON public.foto_cantiere FROM anon,authenticated,service_role;
   GRANT ALL ON public.foto_cantiere TO anon,authenticated,service_role;
   GRANT SELECT,DELETE ON public.foto_cantiere TO artecna_cantieri_delete_rpc;
   GRANT UPDATE(cantiere_id) ON public.foto_cantiere TO artecna_cantieri_delete_rpc;`)
  for(const n of ['20261003_rapportino_prestazioni_step2.sql','20261003_rapportino_servizio_step3.sql','20261003_rapportino_backend_pooler.sql',
   '20261004_rapportino_lettura_portale.sql','20261004_rapportino_allegati_registro.sql','20261004_rapportino_allegati_prenotazione.sql',
   '20261004_rapportino_allegati_finalizzazione.sql','20261004_rapportino_allegati_lettura.sql','20261004_rapportino_allegati_cancellazione.sql','20261004_rapportino_allegati_tombstone.sql'])await installer.query(read(n))
  await installer.query(`CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean); CREATE TABLE storage.objects(id integer,bucket_id text);
   ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
   CREATE POLICY preventivi ON storage.objects TO anon USING(bucket_id='preventivi') WITH CHECK(bucket_id='preventivi');`)
  await installer.query(read('20261007_f3c37_foto_v1_core_riconciliato.sql'))
  await installer.query('ALTER TABLE public.rapportini ADD COLUMN costo_materiali text')
  for(const n of ['20261006_rapportino_materiali_schema.sql','20261006_rapportino_materiali_writer.sql','20261006_rapportino_materiali_lettura.sql','20261025_rapportino_desktop_lettura_v1.sql'])await installer.query(read(n))
  for(const f of require('./desktopLetturaProduction.fixture.json').filter(x=>x.firma.startsWith('artecna_guardie.')))await installer.query(f.definizione)
  await installer.query(read('20261008_f4c1_lettura_foto_desktop.sql'))
  // Production precheck: this private helper is absent, and must be installed by the candidate.
  assert.equal((await q(admin,"SELECT to_regprocedure('artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb)') AS helper"))[0].helper,null)
  await installer.query('INSERT INTO artecna_rapportini.sessioni_portale(token_sha256,operaio_id,scade_at) VALUES(sha256(convert_to($1,\'UTF8\')),$2,statement_timestamp()+interval \'8 hours\')',[TOKEN,OP])
  await installer.query("UPDATE public.rapportini SET versione_prestazioni=1,materiali='Legacy',quantita_materiali='Due sacchi' WHERE id=$1",[RAP])
  backend=await connect('artecna_rapportini_backend')
  const as=async(role,fn)=>fn(await connect(role))
  const desktopRead=async(version=1,c=A)=>as('authenticated',async cdb=>{await cdb.query("SET request.jwt.claim.sub='"+USER+"'");return(await q(cdb,'SELECT public.leggi_rapportino_desktop($1,$2,$3,$4::smallint) v',[c,'2026-09-21',RAP,version]))[0].v})
  const mobileRead=async()=> (await q(backend,'SELECT public.leggi_rapportino_portale($1,$2,$3,$4,2::smallint) v',[TOKEN,A,'2026-09-21',RAP]))[0].v
  const snapshot=async()=>({
   schema:await q(admin,`SELECT c.oid,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity,a.attnum,a.attname,a.atttypid,a.attacl::text
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0
    WHERE n.nspname IN('public','artecna_rapportini','storage') AND c.relkind='r' ORDER BY c.oid,a.attnum`),
   constraints:await q(admin,'SELECT oid,pg_get_constraintdef(oid) d FROM pg_constraint ORDER BY oid'),
   policies:await q(admin,'SELECT * FROM pg_policy ORDER BY oid'),
   data:await q(admin,`SELECT to_jsonb(r) v FROM public.rapportini r ORDER BY id`),
   registry:await q(admin,'SELECT * FROM artecna_rapportini.allegati ORDER BY id'),
   functions:await q(admin,`SELECT oid,proowner,proacl::text,prosecdef,provolatile,proconfig,prosrc FROM pg_proc WHERE pronamespace IN('public'::regnamespace,'artecna_rapportini'::regnamespace,'artecna_foto_desktop'::regnamespace) ORDER BY oid`)
  })
  const previousRead=await desktopRead(),before=await snapshot()
  await t.test('precondizione helper gia presente: abort atomico, nessuna sostituzione silenziosa',async()=>{
   await installer.query(definition('20261007_rapportino_desktop_lettura.sql','artecna_rapportini.arricchisci_lettura_rapportino_v2'))
   const original=await snapshot();await assert.rejects(()=>installer.query(migration),e=>/Helper V2 gia presente/.test(e.message))
   await db.exec('ROLLBACK');assert.deepEqual(await snapshot(),original)
   await installer.query('DROP FUNCTION artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb)')
  })
  await installer.query(migration)
  await t.test('helper V2 creato dalla migration: sorgente esatta, STABLE INVOKER, ACL postgres only',async()=>{
   const f=(await q(admin,"SELECT prosrc,pg_get_userbyid(proowner) AS owner,prosecdef,provolatile,proconfig,pg_get_function_result(oid) AS result FROM pg_proc WHERE oid='artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb)'::regprocedure"))[0]
   assert.equal(f.prosrc,definition('20261007_rapportino_desktop_lettura.sql','artecna_rapportini.arricchisci_lettura_rapportino_v2').split('$fn$')[1])
   assert.equal(require('node:crypto').createHash('sha256').update(f.prosrc).digest('hex'),'5ee5af07746556b6e18cc2a4cdf53792ccb11d9a561ed150161eba610aa01793')
   assert.equal(f.owner,'postgres');assert.equal(f.result,'jsonb');assert.equal(f.prosecdef,false);assert.equal(f.provolatile,'s');assert.deepEqual(f.proconfig,['search_path=pg_catalog, pg_temp'])
   for(const role of ['anon','authenticated','service_role','artecna_rapportini_backend','artecna_foto_v1_writer'])assert.equal((await q(admin,"SELECT has_function_privilege($1,'artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb)','EXECUTE') AS allowed",[role]))[0].allowed,false)
   const acl=await q(admin,"SELECT pg_get_userbyid(a.grantee) AS grantee,a.privilege_type,a.is_grantable FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.oid='artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb)'::regprocedure")
   assert.deepEqual(acl,[{grantee:'postgres',privilege_type:'EXECUTE',is_grantable:false}])
  })
  await t.test('audit: zero DML, tabelle/FK/RLS/ACL immutate; solo tre funzioni sostituite',async()=>{
   const after=await snapshot();for(const key of ['schema','constraints','policies','data','registry'])assert.deepEqual(after[key],before[key],key)
   const changed=before.functions.filter(f=>JSON.stringify(f)!==JSON.stringify(after.functions.find(x=>x.oid===f.oid)))
   assert.equal(after.functions.length-before.functions.length,5,'two private photo cores, two photo wrappers and one private reader helper')
   assert.equal(changed.length,3);for(const f of changed){const now=after.functions.find(x=>x.oid===f.oid);for(const k of ['proowner','proacl','prosecdef','provolatile','proconfig'])assert.deepEqual(now[k],f[k],k)}
  })
  await t.test('ACL effettive: solo backend sui wrapper, core solo owner; bypass authenticated negato',async()=>{
   for(const sig of ['public.prenota_allegato_rapportino_desktop(uuid,uuid,uuid,date,uuid,text,text,bigint)','public.finalizza_allegato_rapportino_desktop(uuid,uuid,uuid)','artecna_rapportini.prenota_allegato_core(text,uuid,uuid,date,uuid,text,text,bigint)','artecna_rapportini.finalizza_allegato_core(text,uuid,uuid)']){
    for(const role of ['authenticated','anon','service_role','artecna_rapportini_backend'])assert.equal((await q(admin,'SELECT has_function_privilege($1,$2,\'EXECUTE\') v',[role,sig]))[0].v,role==='artecna_rapportini_backend'&&sig.startsWith('public.'))
   }
   for(const role of ['authenticated','anon'])await as(role,c=>reject(()=>c.query('SELECT public.finalizza_allegato_rapportino_desktop($1,$2,$3)',[USER,RAP,randomUUID()]),'42501'))
   await as('authenticated',c=>reject(()=>c.query('SELECT public.prenota_allegato_rapportino_desktop($1,$2,$3,$4,$5,$6,$7,$8)',[USER,RAP,A,'2026-09-21',randomUUID(),'ab'.repeat(32),'image/jpeg',100]),'42501'))
  })
  const reserve=async(user=USER,key=randomUUID(),hash='ab'.repeat(32),c=A)=> (await q(backend,'SELECT public.prenota_allegato_rapportino_desktop($1,$2,$3,$4,$5,$6,$7,$8) v',[user,RAP,c,'2026-09-21',key,hash,'image/jpeg',100]))[0].v
  const finalize=async(r,user=USER,lease=r.lease_id)=>(await q(backend,'SELECT public.finalizza_allegato_rapportino_desktop($1,$2,$3) v',[user,r.allegato_id,lease]))[0].v
  await t.test('utente non autorizzato e contesto incoerente: nessuna prenotazione',async()=>{await reject(()=>reserve(randomUUID()),'42501');await reject(()=>reserve(USER,randomUUID(),'ab'.repeat(32),B),'42501');assert.equal((await q(admin,'SELECT count(*) n FROM artecna_rapportini.allegati'))[0].n,0)})
  await t.test('desktop: lease, finalizzazione, elenco e resolver download, retry senza duplicati',async()=>{
   const r=await reserve();await reject(()=>finalize(r,USER,randomUUID()),'PR409');await reject(()=>finalize(r,randomUUID()),'42501')
   const done=await finalize(r);assert.equal(done.stato,'finalizzato');assert.deepEqual(await finalize(r),done)
   const list=await as('authenticated',async c=>{await c.query("SET ROLE authenticated; SET request.jwt.claim.sub='"+USER+"'");try{return(await q(c,'SELECT public.elenca_foto_rapportino_desktop($1) v',[RAP]))[0].v}finally{await c.query('RESET ROLE')}})
   assert.equal(list.allegati.length,1);assert.equal(list.allegati[0].allegato_id,r.allegato_id)
   const resolved=(await q(backend,'SELECT artecna_foto_desktop.risolvi($1,$2) v',[r.allegato_id,USER]))[0].v;assert.equal(resolved.bucket,'rapportini-v1')
  })
  await t.test('retry lease scaduto e hash incoerente; nessuna riscrittura identita',async()=>{
   const key=randomUUID(),r=await reserve(USER,key);await reject(()=>reserve(USER,key,'cd'.repeat(32)),'PR409')
   await admin.query("UPDATE artecna_rapportini.allegati SET lease_until=statement_timestamp()-interval '1 second' WHERE id=$1",[r.allegato_id]);await reject(()=>finalize(r),'PR409')
   const renewed=await reserve(USER,key);assert.equal(renewed.allegato_id,r.allegato_id);assert.notEqual(renewed.lease_id,r.lease_id)
  })
  await t.test('mobile invariato: sessione valida, prenota/finalizza stesso core; token errato negato',async()=>{
   await reject(()=>backend.query('SELECT public.prenota_allegato_rapportino_portale($1,$2,$3,$4,$5,$6,$7,$8)',['bad',RAP,A,'2026-09-21',randomUUID(),'ab'.repeat(32),'image/jpeg',100]),'PR401')
   const r=(await q(backend,'SELECT public.prenota_allegato_rapportino_portale($1,$2,$3,$4,$5,$6,$7,$8) v',[TOKEN,RAP,A,'2026-09-21',randomUUID(),'ab'.repeat(32),'image/jpeg',100]))[0].v
   assert.equal((await q(backend,'SELECT public.finalizza_allegato_rapportino_portale($1,$2,$3) v',[TOKEN,r.allegato_id,r.lease_id]))[0].v.stato,'finalizzato')
  })
  await t.test('reader V1 identico al parent; V2 vuoto e legacy separato; accesso negato',async()=>{
   assert.deepEqual(await desktopRead(),previousRead);assert.deepEqual(await desktopRead(2),await mobileRead());await reject(()=>desktopRead(2,B),'42501')
   const r=await desktopRead(2)
   assert.equal(r.dettaglio.versione_materiali,0);assert.deepEqual(r.dettaglio.materiali,[]);assert.equal(r.dettaglio.documento_legacy_materiali.materiali,'Legacy')
  })
  await t.test('writer comune desktop null / mobile sessione; V2 decimali, null, zero, revisioni/rimozioni e parita',async()=>{
   const empty=()=>({nuove:[],aggiornate:[],rimosse:[]}),mat=(cost)=>({materiale_id:null,chiave_client:randomUUID(),descrizione:'Materiale',unita_misura:'kg',quantita:'2.500000',costo_unitario:cost,note:'Nota'})
   const v1=await desktopRead(),payload={versione_contratto:2,richiesta_id:randomUUID(),rapportino_id:RAP,revisione_attesa:v1.dettaglio.revisione,cantiere_id:A,data:'2026-09-21',documento:{note:'Condivise'},prestazioni:empty(),materiali:{...empty(),nuove:[mat(null),mat('0.000000'),mat('2.000000')]}}
   const written=await as('authenticated',async c=>{await c.query("SET request.jwt.claim.sub='"+USER+"'");return(await q(c,'SELECT public.salva_rapportino_con_prestazioni($1::jsonb,NULL) v',[JSON.stringify(payload)]))[0].v})
   let d=await desktopRead(2);assert.deepEqual(d,await mobileRead());assert.deepEqual(d.dettaglio.materiali,written.materiali);assert.equal(d.dettaglio.materiali.length,3)
   assert.equal(d.dettaglio.riepilogo_materiali.totale_materiali_valorizzati,'5.00');assert.equal(d.dettaglio.riepilogo_materiali.numero_materiali_da_valorizzare,1)
   const paid=d.dettaglio.materiali.find(m=>m.costo_unitario==='2.000000')
   payload.richiesta_id=randomUUID();payload.revisione_attesa=written.revisione;payload.materiali={...empty(),rimosse:[paid.materiale_id]}
   await q(backend,'SELECT public.salva_rapportino_con_prestazioni($1::jsonb,$2) v',[JSON.stringify(payload),TOKEN]);d=await desktopRead(2);assert.deepEqual(d,await mobileRead());assert(d.dettaglio.materiali.find(m=>m.materiale_id===paid.materiale_id).rimossa_at);assert.equal(d.dettaglio.riepilogo_materiali.totale_materiali_valorizzati,'0.00')
  })
  await t.test('fail-closed: seconda installazione rifiutata senza modifiche',async()=>{const before=await snapshot();await assert.rejects(()=>installer.query(migration));await db.exec('ROLLBACK');assert.deepEqual(await snapshot(),before)})
  await t.test('quota comune di 20 allegati, contesto data errato rifiutato',async()=>{
   await reject(()=>backend.query('SELECT public.prenota_allegato_rapportino_desktop($1,$2,$3,$4,$5,$6,$7,$8)',[USER,RAP,A,'2026-09-22',randomUUID(),'ab'.repeat(32),'image/jpeg',100]),'PR409')
   const count=Number((await q(admin,'SELECT count(*) n FROM artecna_rapportini.allegati'))[0].n)
   for(let i=count;i<20;i++)await reserve()
   await reject(()=>reserve(),'PR409')
  })
 }finally{await Promise.allSettled(clients.map(c=>c.end()));await db.close()}
})
