// SOLO PostgreSQL 17.6 localhost. Nessuna FK rimossa per consentire i test.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {A,B,RAP,USER,OP}=require('./fixtureStep3.cjs')
const audit=require('./f3c33DistruzioneProduction.fixture.json')
const dir=path.resolve(__dirname,'../../../supabase/migrations')
const read=n=>fs.readFileSync(path.join(dir,n),'utf8')
const bridge=read('20261007_f3c31_baseline_distruzione.sql')
const compat=read('20261007_f3c32_compatibilita_legacy_foto.sql')
const reconcile=read('20261007_f3c33_manifest_eliminazione_cantiere.sql')
const ident=s=>'"'+s.replaceAll('"','""')+'"'
const query=async(c,s,args=[])=>(await c.query(s,args)).rows
function literalProductionDefinition(r){
 const marker=/\bAS\s+(\$[A-Za-z0-9_]*\$)/.exec(r.definition)
 assert(marker,'Delimitatore corpo assente: '+r.metadata.firma)
 const delimiter=marker[1],start=r.definition.indexOf(delimiter,marker.index),end=r.definition.indexOf(delimiter,start+delimiter.length)
 assert(end>=0&&r.definition.indexOf(delimiter,end+delimiter.length)<0,'Delimitazione ambigua: '+r.metadata.firma)
 assert(!r.metadata.prosrc.includes(delimiter),'Delimitatore presente in prosrc: '+r.metadata.firma)
 return r.definition.slice(0,start+delimiter.length)+r.metadata.prosrc+r.definition.slice(end)
}
async function verifyProductionFunction(h,r){
 const m=r.metadata
 const rows=await query(h.admin,`SELECT pg_get_function_arguments(p.oid) arguments,pg_get_userbyid(p.proowner) owner,l.lanname language,p.prosecdef definer,p.provolatile volatility,p.prokind kind,p.proconfig config,p.proacl::text acl,p.pronargdefaults defaults,p.proretset setof,pg_get_function_result(p.oid) result,p.prosrc body,length(p.prosrc) body_length,encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex') hash,length(replace(p.prosrc,E'\\r\\n',''))-length(replace(replace(p.prosrc,E'\\r\\n',''),E'\\r','')) isolated_cr FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure($1)`,[m.firma])
 assert.equal(rows.length,1,'Funzione mancante: '+m.firma)
 const actual=rows[0]
 assert(actual.body===m.prosrc,'prosrc letterale divergente: '+m.firma)
 assert.equal(actual.body_length,[...m.prosrc].length,'Lunghezza prosrc: '+m.firma)
 assert.equal(actual.hash,m.sha256_crlf_lf,'Fingerprint Production: '+m.firma)
 const isolatedCR=(m.prosrc.replace(/\r\n/g,'').match(/\r/g)||[]).length
 assert.equal(actual.isolated_cr,isolatedCR,'CR isolati: '+m.firma)
 assert.equal(isolatedCR>0,m.cr_isolati,'Flag CR audit: '+m.firma)
 const fields={arguments:'argomenti',owner:'owner',language:'language',definer:'security_definer',volatility:'volatility',kind:'prokind',config:'proconfig',acl:'acl_raw',defaults:'n_defaults',setof:'returns_set',result:'result'}
 for(const [k,v] of Object.entries(fields))assert.deepEqual(actual[k],m[v],'Metadata '+k+': '+m.firma)
}
const destroy="SELECT * FROM public.elimina_cantiere_definitivamente($1,'ELIMINA')"
const funcs=audit.records.filter(r=>r.category==='02_funzione')
const prod=n=>funcs.find(r=>r.metadata.nome===n)
const existing=fs.readFileSync(path.join(__dirname,'f3c32CompatSql.test.cjs'),'utf8')
// Il setup F3C3.2 ridotto usa TEXT per due chiavi Preventivi. Qui si crea
// direttamente UUID certificato, prima dei dati e delle FK: nessun cast/ALTER TYPE.
const setupSource=existing.slice(0,existing.indexOf('async function snapshot'))
assert.equal(setupSource.split('CREATE TABLE public.preventivi_cantiere(id text PRIMARY KEY').length,2)
assert.equal(setupSource.split('ADD preventivo_contrattuale_id text;').length,2)
const setupPart=setupSource
 .replace('CREATE TABLE public.preventivi_cantiere(id text PRIMARY KEY','CREATE TABLE public.preventivi_cantiere(id uuid PRIMARY KEY')
 .replace('ADD preventivo_contrattuale_id text;','ADD preventivo_contrattuale_id uuid;')
 .replace(' await h.install()',' // Core eseguito dopo la ricostruzione della baseline')
const setup=new Function('require','__dirname',setupPart+';return setup;')(require,__dirname)
async function baseline(h){
 await setup(h)
 // Schema privato: owner e soli grant certificati dall'audit Production.
 const destructionSchema=audit.records.find(r=>r.category==='08_schema'&&r.object==='artecna_distruzione').metadata
 assert.equal(destructionSchema.owner,'postgres')
 assert.equal(destructionSchema.acl_raw,'{postgres=UC/postgres,artecna_cantieri_delete_rpc=U/postgres}')
 await h.admin.query('ALTER SCHEMA artecna_distruzione OWNER TO postgres')
 const schemaGrantees=await query(h.admin,`SELECT DISTINCT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END role FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='artecna_distruzione'`)
 for(const g of schemaGrantees)await h.admin.query('REVOKE ALL ON SCHEMA artecna_distruzione FROM '+(g.role==='PUBLIC'?'PUBLIC':ident(g.role)))
 await h.admin.query('REVOKE ALL ON SCHEMA artecna_distruzione FROM PUBLIC')
 await h.installer.query('GRANT USAGE,CREATE ON SCHEMA artecna_distruzione TO postgres; GRANT USAGE ON SCHEMA artecna_distruzione TO artecna_cantieri_delete_rpc')
 const schemaCatalog=await query(h.admin,"SELECT pg_get_userbyid(nspowner) owner,nspacl::text acl FROM pg_namespace WHERE nspname='artecna_distruzione'")
 assert.deepEqual(schemaCatalog,[{owner:destructionSchema.owner,acl:destructionSchema.acl_raw}])
 const schemaPrivileges=await query(h.admin,"SELECT rolname role,has_schema_privilege(oid,'artecna_distruzione','USAGE') usage,has_schema_privilege(oid,'artecna_distruzione','CREATE') create_privilege,rolsuper FROM pg_roles ORDER BY rolname")
 // L'ACL esatta sopra esclude grant espliciti extra. I privilegi effettivi
 // degli altri ruoli possono derivare da superuser o ruoli predefiniti.
 for(const role of ['postgres','artecna_cantieri_delete_rpc']){
  const r=schemaPrivileges.find(r=>r.role===role)
  assert(r,'Ruolo schema mancante: '+role)
  assert.equal(r.usage,true,'USAGE schema divergente: '+role)
  assert.equal(r.create_privilege,role==='postgres','CREATE schema divergente: '+role)
 }
 for(const r of audit.records.filter(r=>r.category==='04_relazione')){
  const m=r.metadata,rel=r.object.split('.').map(ident).join('.')
  const exists=(await query(h.admin,'SELECT to_regclass($1) v',[r.object]))[0].v
  if(!exists)await h.admin.query('CREATE TABLE '+rel+'('+m.colonne.map(c=>ident(c.nome)+' '+c.tipo).join(',')+')')
  else for(const c of m.colonne){
   const has=(await query(h.admin,'SELECT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=$1::regclass AND attname=$2 AND NOT attisdropped) v',[r.object,c.nome]))[0].v
   if(!has){
    const materialsVersion=r.object==='public.rapportini'&&c.nome==='versione_materiali'
    if(materialsVersion){assert.equal(c.tipo,'smallint');assert.equal(c.not_null,true)}
    await h.admin.query('ALTER TABLE '+rel+' ADD COLUMN '+ident(c.nome)+' '+c.tipo+(materialsVersion?' NOT NULL DEFAULT 0':''))
   }
  }
 }
 // Solo Materiali: ricostruzione dei privilegi certificati, senza grant extra.
 const materialsTable=audit.records.find(r=>r.category==='04_relazione'&&r.object==='public.rapportino_materiali').metadata
 assert.equal(materialsTable.owner,'postgres')
 assert.equal(materialsTable.acl_raw,'{postgres=arwdDxtm/postgres,artecna_rapportini_rpc=arw/postgres}')
 assert.equal(materialsTable.rls,true);assert.equal(materialsTable.force_rls,false)
 assert(materialsTable.colonne.every(c=>c.acl_raw===null),'ACL colonna Materiali audit inattese')
 await h.admin.query('ALTER TABLE public.rapportino_materiali OWNER TO postgres')
 const materialGrantees=await query(h.admin,`SELECT DISTINCT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END role FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='public.rapportino_materiali'::regclass`)
 for(const g of materialGrantees)await h.admin.query('REVOKE ALL ON public.rapportino_materiali FROM '+(g.role==='PUBLIC'?'PUBLIC':ident(g.role)))
 await h.admin.query('REVOKE ALL ON public.rapportino_materiali FROM PUBLIC; ALTER TABLE public.rapportino_materiali ENABLE ROW LEVEL SECURITY; ALTER TABLE public.rapportino_materiali NO FORCE ROW LEVEL SECURITY')
 await h.installer.query('GRANT ALL ON public.rapportino_materiali TO postgres; GRANT SELECT,INSERT,UPDATE ON public.rapportino_materiali TO artecna_rapportini_rpc')
 const materialsCatalog=await query(h.admin,`SELECT pg_get_userbyid(relowner) owner,relacl::text acl,relrowsecurity rls,relforcerowsecurity force_rls FROM pg_class WHERE oid='public.rapportino_materiali'::regclass`)
 assert.deepEqual(materialsCatalog,[{owner:materialsTable.owner,acl:materialsTable.acl_raw,rls:materialsTable.rls,force_rls:materialsTable.force_rls}])
 const materialsColumns=await query(h.admin,`SELECT attname name,attacl::text acl FROM pg_attribute WHERE attrelid='public.rapportino_materiali'::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum`)
 assert.deepEqual(materialsColumns,materialsTable.colonne.map(c=>({name:c.nome,acl:c.acl_raw})))
 for(const role of ['postgres','artecna_rapportini_rpc','artecna_cantieri_delete_rpc']){
  for(const privilege of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']){
   const effective=(await query(h.admin,"SELECT has_table_privilege($1,'public.rapportino_materiali',$2) allowed",[role,privilege]))[0].allowed
   assert.equal(effective,role==='postgres'||(role==='artecna_rapportini_rpc'&&['SELECT','INSERT','UPDATE'].includes(privilege)),'Privilegio Materiali divergente: '+role+' '+privilege)
  }
 }
 await h.installer.query('BEGIN')
 try{await h.installer.query('LOCK TABLE public.rapportino_materiali IN SHARE ROW EXCLUSIVE MODE')}finally{await h.installer.query('ROLLBACK')}
 // Verifica TUTTI gli endpoint delle 45 FK contro format_type del catalogo,
 // inclusi quelli già forniti dal setup condiviso. Drift di tipo => abort.
 const verifiedColumns=new Set()
 for(const r of audit.records.filter(r=>r.category==='03_fk')){
  const m=r.metadata
  for(const [rel,columns] of [[m.schema_figlia+'.'+m.tabella_figlia,m.colonne_figlia],[m.schema_padre+'.'+m.tabella_padre,m.colonne_padre]]){
   const certified=audit.records.find(r=>r.category==='04_relazione'&&r.object===rel)
   assert(certified,'Metadata relazione mancanti: '+rel)
   for(const column of columns){
    const key=rel+'.'+column
    if(verifiedColumns.has(key))continue
    const expected=certified.metadata.colonne.find(c=>c.nome===column)
    const actual=await query(h.admin,'SELECT format_type(atttypid,atttypmod) tipo FROM pg_attribute WHERE attrelid=$1::regclass AND attname=$2 AND NOT attisdropped',[rel,column])
    assert.equal(actual.length,1,'Endpoint FK mancante: '+key)
    assert.equal(actual[0].tipo,expected.tipo,'Tipo endpoint FK divergente: '+key)
    verifiedColumns.add(key)
   }
  }
 }
 assert.equal(audit.records.filter(r=>r.category==='03_fk').length,45)
 for(const r of audit.records.filter(r=>r.category==='03_fk')){
  const m=r.metadata,child=m.schema_figlia+'.'+m.tabella_figlia,parent=m.schema_padre+'.'+m.tabella_padre
  const rel=child.split('.').map(ident).join('.')
  if((await query(h.admin,'SELECT oid FROM pg_constraint WHERE conrelid=$1::regclass AND conname=$2',[child,m.constraint])).length)continue
  const same=await query(h.admin,`SELECT k.conname FROM pg_constraint k WHERE k.contype='f' AND k.conrelid=$1::regclass AND k.confrelid=$2::regclass AND (SELECT array_agg(a.attname::text ORDER BY x.ord) FROM unnest(k.conkey) WITH ORDINALITY x(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=x.num)=$3::text[]`,[child,parent,m.colonne_figlia])
  if(same.length){await h.admin.query('ALTER TABLE '+rel+' RENAME CONSTRAINT '+ident(same[0].conname)+' TO '+ident(m.constraint));continue}
  const unique=(await query(h.admin,`SELECT EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=$1::regclass AND i.indisunique AND (SELECT array_agg(a.attname::text ORDER BY x.ord) FROM unnest(i.indkey::smallint[]) WITH ORDINALITY x(num,ord) JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=x.num)=$2::text[]) v`,[parent,m.colonne_padre]))[0].v
  if(!unique)await h.admin.query('CREATE UNIQUE INDEX '+ident('fixture_key_'+m.tabella_padre+'_'+m.colonne_padre.join('_'))+' ON '+parent.split('.').map(ident).join('.')+'('+m.colonne_padre.map(ident).join(',')+')')
  await h.admin.query('ALTER TABLE '+rel+' ADD CONSTRAINT '+ident(m.constraint)+' '+r.definition)
 }
 for(const r of funcs.filter(r=>r.metadata.schema==='artecna_distruzione'||['elimina_cantiere_definitivamente','proteggi_strutturato','proteggi_materiale','materiali_fail_closed','proteggi_ponte_economia'].includes(r.metadata.nome))){
  await h.admin.query(literalProductionDefinition(r))
  await h.admin.query('ALTER FUNCTION '+r.metadata.firma+' OWNER TO '+ident(r.metadata.owner))
  const grants=await query(h.admin,"SELECT DISTINCT grantee FROM aclexplode(coalesce((SELECT proacl FROM pg_proc WHERE oid=$1::regprocedure),acldefault('f',(SELECT proowner FROM pg_proc WHERE oid=$1::regprocedure))))",[r.metadata.firma])
  for(const g of grants){const role=g.grantee===0?'PUBLIC':(await query(h.admin,'SELECT pg_get_userbyid($1) v',[g.grantee]))[0].v;if(role!==r.metadata.owner)await h.admin.query('REVOKE ALL ON FUNCTION '+r.metadata.firma+' FROM '+(role==='PUBLIC'?role:ident(role)))}
  for(const g of r.metadata.acl)if(g.grantee!==r.metadata.owner)await h.admin.query('GRANT '+g.privilege+' ON FUNCTION '+r.metadata.firma+' TO '+ident(g.grantee))
  await verifyProductionFunction(h,r)
 }
 await h.admin.query('REVOKE ALL ON public.foto_cantiere FROM artecna_cantieri_delete_rpc; GRANT SELECT,DELETE ON public.foto_cantiere TO artecna_cantieri_delete_rpc; GRANT UPDATE(cantiere_id) ON public.foto_cantiere TO artecna_cantieri_delete_rpc')
 for(const r of audit.records.filter(r=>r.category==='05_trigger'&&!r.metadata.internal&&['artecna_rapportini.proteggi_strutturato()','artecna_rapportini.proteggi_materiale()','artecna_rapportini.materiali_fail_closed()','artecna_guardie.proteggi_ponte_economia()'].includes(r.metadata.funzione))){
  const parts=r.object.split('.')
  if(!(await query(h.admin,'SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname=$1 AND tgrelid=$2::regclass) v',[parts.at(-1),parts.slice(0,-1).join('.')]))[0].v)await h.admin.query(r.definition)
 }
 const materialsVersion=await query(h.admin,`SELECT format_type(a.atttypid,a.atttypmod) tipo,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) default_value FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid='public.rapportini'::regclass AND a.attname='versione_materiali' AND NOT a.attisdropped`)
 assert.deepEqual(materialsVersion,[{tipo:'smallint',attnotnull:true,default_value:'0'}])
 assert.equal((await query(h.admin,'SELECT count(*)::integer n FROM public.rapportini WHERE versione_materiali IS NULL'))[0].n,0)
 const resolvedContext=await query(h.installer,"SELECT 'artecna_distruzione.inizia_contesto(uuid)'::regprocedure::oid oid")
 const catalogContext=await query(h.admin,"SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='artecna_distruzione' AND p.proname='inizia_contesto' AND p.proargtypes='2950'::oidvector AND p.prokind='f'")
 assert.equal(catalogContext.length,1)
 assert.deepEqual(resolvedContext,catalogContext)
 return async()=>{
  await h.install()
  await verifyProductionFunction(h,prod('elimina_cantiere_definitivamente'))
  await h.installer.query(bridge)
  await h.installer.query(compat)
  await h.installer.query(reconcile)
 }
}
async function auth(h,action){return h.as('authenticated',async c=>{await c.query("SELECT set_config('test.user',$1,false)",[USER]);return action(c)})}
async function snapshot(h){return {
 data:await query(h.admin,`SELECT jsonb_build_object('cantieri',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.cantieri t),'rapportini',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.rapportini t),'photos',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.foto_cantiere t),'allegati',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM artecna_rapportini.allegati t),'outbox',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM artecna_distruzione.cleanup_storage t),'contesto',(SELECT jsonb_agg(to_jsonb(t)) FROM artecna_distruzione.contesto t)) v`),
 functions:await query(h.admin,'SELECT oid,to_jsonb(p) v FROM pg_proc p ORDER BY oid'),
 fk:await query(h.admin,"SELECT oid,to_jsonb(k) v FROM pg_constraint k WHERE contype='f' ORDER BY oid"),
 acl:await query(h.admin,"SELECT oid,relacl::text,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace IN ('public'::regnamespace,'artecna_rapportini'::regnamespace,'artecna_distruzione'::regnamespace) ORDER BY oid")
}}
async function scenarios(t,lab,connect){
 const run=async(name,fn)=>{let failure;await t.test(name,async()=>{try{await lab(fn)}catch(e){failure=e;throw e}});if(failure)throw failure}
 await run('sequenza completa e ripetizione fail-closed: core, prerequisite, F3C3.2, F3C3.3',async h=>{
  const install=await baseline(h);await install()
  for(const r of audit.records.filter(r=>r.category==='03_fk'))assert.equal((await query(h.admin,'SELECT count(*)::integer n FROM pg_constraint WHERE conrelid=$1::regclass AND conname=$2',[r.metadata.schema_figlia+'.'+r.metadata.tabella_figlia,r.metadata.constraint]))[0].n,1)
  assert.equal((await query(h.admin,"SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') h FROM pg_proc WHERE oid='public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure"))[0].h,'29c4eafe08d4e3d5b854929478992090e8f8b28f2f504f777ea0cd33e58e6a90')
  const state=await snapshot(h);await assert.rejects(()=>h.installer.query(reconcile));await h.installer.query('ROLLBACK');assert.deepEqual(await snapshot(h),state)
 })
 await run('V0 con tutti i vincoli e Allegati soltanto altrove',async h=>{
  const install=await baseline(h);await install();await h.reserve();await h.admin.query("INSERT INTO public.utenti_cantiere VALUES($1,$2,'owner')",[B,USER])
  const result=await auth(h,c=>query(c,destroy,[B]));assert.equal(result[0].eliminato,true)
  assert.equal((await query(h.admin,'SELECT count(*)::integer n FROM artecna_rapportini.allegati WHERE cantiere_id=$1',[A]))[0].n,1)
 })
 for(const mode of ['allegato','versione','richieste','prestazioni'])await run('target protetto '+mode+': zero mutazioni',async h=>{
  const install=await baseline(h);await install()
  if(mode==='allegato')await h.reserve()
  if(mode==='richieste')await h.admin.query("INSERT INTO artecna_rapportini.richieste(utente_id,richiesta_id,rapportino_id,payload_sha256,risultato) VALUES($1,gen_random_uuid(),$2,decode(repeat('ab',32),'hex'),'{}')",[USER,RAP])
  if(mode==='prestazioni')await h.admin.query("INSERT INTO public.rapportino_prestazioni(rapportino_id,operaio_id,chiave_client,ora_inizio,ora_fine) VALUES($1,$2,'fixture','08:00','09:00')",[RAP,OP])
  const before=await snapshot(h);await auth(h,c=>assert.rejects(()=>c.query(destroy,[A]),e=>e.code==='P2131'));assert.deepEqual(await snapshot(h),before)
 })
 await run('FK sconosciuta: abort prima contesto/outbox',async h=>{
  const install=await baseline(h);await install();await h.admin.query('CREATE TABLE public.inattesa(id uuid REFERENCES public.cantieri(id))')
  await h.admin.query("INSERT INTO public.utenti_cantiere VALUES($1,$2,'owner')",[B,USER])
  const before=await snapshot(h);await auth(h,c=>assert.rejects(()=>c.query(destroy,[B]),e=>e.code==='P2113'));assert.deepEqual(await snapshot(h),before)
 })
 await run('post-check prerequisite: rollback corpo, OID, ACL e membership',async h=>{
  await baseline(h);await h.install();const before=await snapshot(h)
  await assert.rejects(()=>h.installer.query(bridge.replace('-- F3C31_POSTCHECK',"DO $$BEGIN RAISE EXCEPTION 'fault'; END$$;")));await h.installer.query('ROLLBACK');assert.deepEqual(await snapshot(h),before)
 })
 await run('post-check F3C3.3: rollback atomico',async h=>{
  await baseline(h);await h.install();await h.installer.query(bridge);await h.installer.query(compat);const before=await snapshot(h)
  await assert.rejects(()=>h.installer.query(reconcile.replace('-- F3C33_POSTCHECK',"DO $$BEGIN RAISE EXCEPTION 'fault'; END$$;")));await h.installer.query('ROLLBACK');assert.deepEqual(await snapshot(h),before)
 })
}
const harness=fs.readFileSync(path.join(__dirname,'f3c3ProiezioneSql.test.cjs'),'utf8')
const start=harness.indexOf("  await t.test('zero proiezioni"),tail=harness.lastIndexOf(' }finally{')
new Function('require','__dirname','scenarios',harness.slice(0,start).replace('F3C3: baseline Production, capability, guardie e compatibilità','F3C3.3: sequenza completa PostgreSQL 17.6')+'  await scenarios(t,lab,connect)\n'+harness.slice(tail))(require,__dirname,scenarios)
