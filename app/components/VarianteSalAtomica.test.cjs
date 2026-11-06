/* eslint-disable @typescript-eslint/no-require-imports -- PostgreSQL isolato, dati sintetici, nessuna rete. */
const {test}=require('node:test')
const a=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const {randomUUID}=require('node:crypto'),{PGlite}=require('@electric-sql/pglite')
const ts=require('typescript'),vm=require('node:vm')
const catalog=require('../engines/preventivo-generation/production-cleanup.fixture.json')
const sql=fs.readFileSync(path.resolve(__dirname,'../../supabase/migrations/20261106_approva_variante_importa_sal.sql'),'utf8')
const fun=n=>catalog.functions.find(f=>f.name===n)
const q=async(db,s,p=[]) => (await db.query(s,p)).rows
const user='11111111-1111-4111-8111-111111111111'
const quote=s=>'"'+s.replaceAll('"','""')+'"'
const salSource=ts.createSourceFile('sal.tsx',fs.readFileSync(path.join(__dirname,'SalDettagliatoPanel.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
const grouping={}
vm.runInNewContext(ts.transpileModule(salSource.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='gruppiRigheSal').getText(salSource),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:grouping})
// Schemi reali delle sole relazioni coinvolte. Nessun dato applicativo esportato.
const names=['cantieri','preventivi_cantiere','varianti_cantiere','variante_lavorazioni','sal_lavorazioni','preventivo_lavorazioni','utenti_cantiere']
async function fixture(){
 const db=new PGlite()
 await db.exec(`CREATE ROLE fixture_installer LOGIN SUPERUSER;
 SET SESSION AUTHORIZATION fixture_installer;
 ALTER ROLE postgres RENAME TO supabase_admin;
 CREATE ROLE postgres LOGIN NOSUPERUSER CREATEROLE CREATEDB BYPASSRLS;
 CREATE ROLE authenticated; CREATE ROLE anon;
 GRANT authenticated TO postgres WITH INHERIT FALSE,SET TRUE;
 CREATE ROLE artecna_varianti_rpc NOLOGIN NOINHERIT BYPASSRLS;
 CREATE ROLE artecna_sal_rpc NOLOGIN NOINHERIT BYPASSRLS;
 GRANT artecna_varianti_rpc,artecna_sal_rpc TO postgres WITH ADMIN TRUE,INHERIT FALSE,SET FALSE GRANTED BY supabase_admin;
 ALTER SCHEMA public OWNER TO postgres;
 CREATE SCHEMA artecna_guardie AUTHORIZATION postgres;
 CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$SELECT gen_random_uuid()$$;`)
 const tables=catalog.relations.filter(t=>t.schema==='public'&&names.includes(t.name))
 for(const t of tables){
  const cols=t.columns.map(c=>`${quote(c.name)} ${c.type}${c.identity?' GENERATED ALWAYS AS IDENTITY':c.default?' DEFAULT '+c.default:''}${c.not_null?' NOT NULL':''}`)
  await db.exec(`CREATE TABLE public.${quote(t.name)} (${cols.join(',')}); ALTER TABLE public.${quote(t.name)} OWNER TO postgres;`)
 }
 for(const t of tables){
  for(const c of t.constraints.filter(c=>c.type!=='f'))await db.exec(`ALTER TABLE public.${quote(t.name)} ADD CONSTRAINT ${quote(c.name)} ${c.definition};`)
  for(const i of t.indexes.filter(i=>!i.primary&&!t.constraints.some(c=>c.name===i.name)))await db.exec(i.definition)
 }
 for(const t of tables){
  // FK delle sole relazioni del caso; gli altri domini non sono simulati.
  for(const c of t.constraints.filter(c=>c.type==='f'&&names.some(n=>c.definition.includes('REFERENCES '+n+'('))))
   await db.exec(`ALTER TABLE public.${quote(t.name)} ADD CONSTRAINT ${quote(c.name)} ${c.definition};`)
 }
 for(const n of ['utente_jwt_corrente','utente_puo_modificare_cantiere','calcola_residuo_componente','valida_correzioni_variante','approva_variante','importa_variante_approvata_nel_sal','leggi_lavorazioni_variante','proteggi_variante_testata']){
  const f=fun(n),sig=(f.schema==='public'?'public.':'')+f.signature
  await db.exec(f.definition)
  await db.exec(`ALTER FUNCTION ${sig} OWNER TO ${f.owner}; REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC;`)
  for(const g of f.grants.filter(g=>['postgres','artecna_varianti_rpc','artecna_sal_rpc','authenticated'].includes(g.grantee)))
   await db.exec(`GRANT EXECUTE ON FUNCTION ${sig} TO ${g.grantee};`)
 }
 await db.exec(`GRANT USAGE ON SCHEMA public,artecna_guardie TO artecna_varianti_rpc,artecna_sal_rpc,authenticated;
 GRANT SELECT ON ALL TABLES IN SCHEMA public TO artecna_varianti_rpc,artecna_sal_rpc,authenticated;
 GRANT UPDATE ON public.cantieri,public.varianti_cantiere TO artecna_varianti_rpc;
 GRANT UPDATE(id) ON public.cantieri TO artecna_sal_rpc;
 GRANT INSERT(cantiere,descrizione,importo_previsto,percentuale,importo_maturato,note,data_aggiornamento,completata,cantiere_id,source_variante_lavorazione_id) ON public.sal_lavorazioni TO artecna_sal_rpc;
 ALTER TABLE public.sal_lavorazioni ENABLE ROW LEVEL SECURITY;
 CREATE POLICY fixture_sal_read ON public.sal_lavorazioni FOR SELECT USING(true);
 CREATE TRIGGER guardia_variante_testata BEFORE INSERT OR UPDATE OR DELETE ON public.varianti_cantiere
 FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_variante_testata();
 SET SESSION AUTHORIZATION postgres;`)
 return db
}
async function seed(db,op='nuova'){
 await db.exec('SET SESSION AUTHORIZATION fixture_installer')
 const c=randomUUID(),p=randomUUID(),v=randomUUID()
 await q(db,"INSERT INTO cantieri(id,nome) VALUES($1,'Fixture SAL')",[c])
 await q(db,"INSERT INTO preventivi_cantiere(id,cantiere,cantiere_id) VALUES($1,'Fixture SAL',$2)",[p,c])
 await q(db,'UPDATE cantieri SET preventivo_contrattuale_id=$1 WHERE id=$2',[p,c])
 await q(db,"INSERT INTO utenti_cantiere(user_id,cantiere_id,ruolo) VALUES($1,$2,'owner')",[user,c])
 await q(db,"INSERT INTO varianti_cantiere(id,cantiere_id,preventivo_contrattuale_id,titolo) VALUES($1,$2,$3,'Fixture')",[v,c,p])
 // Bootstrap delle righe proposta: non simula il writer di redazione, fuori scope.
 const trigger='ALTER TABLE variante_lavorazioni DISABLE TRIGGER USER'
 await db.exec(trigger)
 let origin=null
 if(op!=='nuova'){
  origin=(await q(db,`INSERT INTO preventivo_lavorazioni(cantiere,cantiere_id,preventivo_id,descrizione,unita_misura,quantita,prezzo_unitario,importo_previsto)
  VALUES('Fixture SAL',$1,$2,'Lavoro','m2',16,45,720) RETURNING id`,[c,p]))[0].id
  await q(db,`INSERT INTO sal_lavorazioni(cantiere,cantiere_id,source_lavorazione_id,descrizione,importo_previsto,percentuale,importo_maturato)
  VALUES('Fixture SAL',$1,$2,'Lavoro',720,25,180)`,[c,origin])
 }
 const qty=op==='eliminazione_residua'?-12:op==='riduzione_residua'?-2:16
 const l=(await q(db,`INSERT INTO variante_lavorazioni(variante_id,numero_riga,descrizione,unita_misura,quantita_delta,prezzo_unitario,delta_contratto,operazione,riferimento_preventivo_lavorazione_id,note)
 VALUES($1,1,'Lavoro','m2',$2,45,$3,$4,$5,'Motivo fixture') RETURNING id`,[v,qty,qty*45,op,origin]))[0].id
 await db.exec('ALTER TABLE variante_lavorazioni ENABLE TRIGGER USER; SET ROLE artecna_varianti_rpc;')
 await q(db,"UPDATE varianti_cantiere SET stato='proposta',numero=1 WHERE id=$1",[v])
 await db.exec(`RESET ROLE; SET SESSION AUTHORIZATION postgres; SET request.jwt.claim.sub='${user}';`)
 return{c,p,v,l,origin}
}
async function approve(db,s){
 await db.exec('SET ROLE authenticated')
 try{return await q(db,"SELECT * FROM public.approva_variante($1,'Conferma fixture')",[s.v])}
 finally{await db.exec('RESET ROLE')}
}
async function importAgain(db,s){
 await db.exec('SET ROLE authenticated')
 try{return (await q(db,'SELECT * FROM public.importa_variante_approvata_nel_sal($1)',[s.v]))[0]}
 finally{await db.exec('RESET ROLE')}
}
const sal=(db,s)=>q(db,'SELECT * FROM sal_lavorazioni WHERE cantiere_id=$1 ORDER BY id',[s.c])
test('audit migration: unico PERFORM, importatore byte-identico, firma/ACL approvazione e schema invariati',async()=>{
 const db=await fixture();try{
  const snapshot=async()=>q(db,`SELECT
   (SELECT jsonb_agg(to_jsonb(p)-'prosrc' ORDER BY p.oid) FROM pg_proc p
     WHERE p.oid='public.approva_variante(uuid,text)'::regprocedure) approvazione,
   (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_constraint c WHERE connamespace='public'::regnamespace) vincoli,
   (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
     WHERE c.relnamespace='public'::regnamespace) colonne,
   (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p) policy,
   (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t WHERE NOT t.tgisinternal) trigger,
   (SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor) FROM pg_auth_members m) membership`)
  const before=await snapshot();await db.exec(sql);a.deepEqual(await snapshot(),before)
  const p=(await q(db,"SELECT prosrc,proacl::text acl FROM pg_proc WHERE oid='public.importa_variante_approvata_nel_sal(uuid)'::regprocedure"))[0]
  a.equal(p.prosrc,fun('importa_variante_approvata_nel_sal').prosrc)
  a(p.acl.includes('artecna_varianti_rpc=X/artecna_sal_rpc'))
  const after=(await q(db,"SELECT prosrc FROM pg_proc WHERE oid='public.approva_variante(uuid,text)'::regprocedure"))[0].prosrc
  a.equal(after.replace(/\r\n/g,'\n').replace('  PERFORM public.importa_variante_approvata_nel_sal(v_variante.id);\n\n',''),fun('approva_variante').prosrc.replace(/\r\n/g,'\n'))
 }finally{await db.close()}
})
test('migration integrale: approvazione nuova/aumento, SAL 0%, rilettura e retry invariati',async()=>{
 const db=await fixture();try{
  await db.exec(sql)
  for(const op of ['nuova','aumento']){
   const s=await seed(db,op),result=await approve(db,s)
   a.equal(result[0].stato,'approvata');a.equal(Number(result[0].importo_delta_approvato),720)
   const rows=await sal(db,s);a.equal(rows.length,op==='aumento'?2:1)
   const added=rows.find(r=>r.source_variante_lavorazione_id===s.l);a(added)
   a.equal(Number(added.percentuale),0);a.equal(Number(added.importo_maturato),0);a.equal(Number(added.importo_previsto),720)
   await db.exec('SET ROLE authenticated')
   const works=await q(db,'SELECT * FROM public.leggi_lavorazioni_variante($1)',[s.v])
   await db.exec('RESET ROLE')
   const detail=grouping.gruppiRigheSal(await sal(db,s),works,true)
   a.equal(detail.operative.length,1);a.equal(detail.operative[0].source_variante_lavorazione_id,s.l);a.equal(detail.nonVerificabili.length,0)
   if(op==='aumento'){const base=rows.find(r=>r.source_lavorazione_id===s.origin);a.equal(Number(base.percentuale),25);a.equal(Number(base.importo_maturato),180)}
   const retry=await importAgain(db,s);a.equal(Number(retry.importate),0);a.equal(Number(retry.gia_presenti),1)
   a.deepEqual(await sal(db,s),rows)
   await a.rejects(()=>approve(db,s),e=>e.code==='P2030');a.deepEqual(await sal(db,s),rows)
  }
 }finally{await db.close()}
})
test('riduzione ed eliminazione residue: nessuna nuova riga, maturato e contratto canonico preservati',async()=>{
 const db=await fixture();try{await db.exec(sql)
  for(const op of ['riduzione_residua','eliminazione_residua']){
   const s=await seed(db,op),before=await sal(db,s)
   await approve(db,s);a.deepEqual(await sal(db,s),before)
   const retry=await importAgain(db,s);a.equal(Number(retry.importate),0)
   await db.exec('SET SESSION AUTHORIZATION fixture_installer; SET ROLE artecna_sal_rpc')
   const residual=(await q(db,"SELECT * FROM artecna_guardie.calcola_residuo_componente('preventivo',$1,$2,$3)",[s.origin,s.c,s.p]))[0]
   await db.exec('RESET ROLE; SET SESSION AUTHORIZATION postgres')
   a.equal(Number(residual.importo_maturato),180)
   a.equal(Number(residual.importo_contrattuale),op==='riduzione_residua'?630:180)
  }
 }finally{await db.close()}
})
test('variante storica già importata: migration e retry non alterano percentuali/dati',async()=>{
 const db=await fixture();try{
  const s=await seed(db);await approve(db,s);await importAgain(db,s)
  await db.exec('SET SESSION AUTHORIZATION fixture_installer')
  await q(db,'UPDATE sal_lavorazioni SET percentuale=40,importo_maturato=288 WHERE cantiere_id=$1',[s.c])
  await db.exec('SET SESSION AUTHORIZATION postgres')
  const before=await sal(db,s);await db.exec(sql);await importAgain(db,s)
  a.deepEqual(await sal(db,s),before)
 }finally{await db.close()}
})
test('importazione parziale storica: recupera tutte le nuove/aumenti mancanti e conserva la riga già maturata',async()=>{
 const db=await fixture();try{
  const s=await seed(db)
  await db.exec('SET SESSION AUTHORIZATION fixture_installer')
  const origin=(await q(db,`INSERT INTO preventivo_lavorazioni(cantiere,cantiere_id,preventivo_id,descrizione,unita_misura,quantita,prezzo_unitario,importo_previsto)
   VALUES('Fixture SAL',$1,$2,'Base','m2',10,45,450) RETURNING id`,[s.c,s.p]))[0].id
  await q(db,`INSERT INTO variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,unita_misura,quantita_delta,prezzo_unitario,delta_contratto,riferimento_preventivo_lavorazione_id)
   VALUES($1,2,'aumento','Aumento','m2',2,45,90,$2),($1,3,'nuova','Seconda','m2',1,45,45,NULL)`,[s.v,origin])
  await db.exec('SET SESSION AUTHORIZATION postgres')
  await approve(db,s)
  await db.exec('SET SESSION AUTHORIZATION fixture_installer')
  await q(db,`INSERT INTO sal_lavorazioni(cantiere,cantiere_id,source_variante_lavorazione_id,descrizione,importo_previsto,percentuale,importo_maturato)
   VALUES('Fixture SAL',$1,$2,'Lavoro',720,50,360)`,[s.c,s.l])
  const before=(await sal(db,s))[0]
  await db.exec('SET SESSION AUTHORIZATION postgres');await db.exec(sql)
  const result=await importAgain(db,s);a.equal(Number(result.importate),2);a.equal(Number(result.gia_presenti),1)
  const after=await sal(db,s);a.equal(after.length,3);a.deepEqual(after.find(r=>r.id===before.id),before)
  a(after.filter(r=>r.id!==before.id).every(r=>Number(r.percentuale)===0&&Number(r.importo_maturato)===0))
  a.equal(Number((await importAgain(db,s)).importate),0);a.deepEqual(await sal(db,s),after)
 }finally{await db.close()}
})
test('errore importazione dopo UPDATE: rollback atomico anche del risultato approvazione',async()=>{
 const db=await fixture();try{await db.exec(sql);const s=await seed(db)
  await db.exec(`SET SESSION AUTHORIZATION fixture_installer;
   CREATE FUNCTION public.fixture_fail_sal() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION USING ERRCODE='P2075',MESSAGE='Fixture SAL failure'; END$$;
   CREATE TRIGGER fixture_fail_sal BEFORE INSERT ON sal_lavorazioni FOR EACH ROW EXECUTE FUNCTION public.fixture_fail_sal();
   SET SESSION AUTHORIZATION postgres;`)
  await a.rejects(()=>approve(db,s),e=>e.code==='P2075')
  const v=(await q(db,'SELECT stato,importo_delta_approvato,approvata_at FROM varianti_cantiere WHERE id=$1',[s.v]))[0]
  a.equal(v.stato,'proposta');a.equal(v.importo_delta_approvato,null);a.equal(v.approvata_at,null);a.equal((await sal(db,s)).length,0)
 }finally{await db.close()}
})
test('guardia JWT/owner e ACL conservate; nessun privilegio temporaneo residuo; drift bloccato',async()=>{
 const db=await fixture();try{await db.exec(sql);const s=await seed(db)
  await db.exec("SET request.jwt.claim.sub='22222222-2222-4222-8222-222222222222'")
  await a.rejects(()=>approve(db,s),e=>e.code==='P2029')
  a.equal((await sal(db,s)).length,0)
  const flags=(await q(db,`SELECT pg_has_role('postgres','artecna_varianti_rpc','SET') role,
    has_schema_privilege('artecna_varianti_rpc','public','CREATE') schema,
    has_function_privilege('anon','public.approva_variante(uuid,text)','EXECUTE') anon`))[0]
  a.deepEqual(flags,{role:false,schema:false,anon:false})
  const before=(await q(db,"SELECT prosrc FROM pg_proc WHERE oid='public.approva_variante(uuid,text)'::regprocedure"))[0].prosrc
  await a.rejects(()=>db.exec(sql),/Corpo, sicurezza o ACL/);await db.exec('ROLLBACK')
  a.equal((await q(db,"SELECT prosrc FROM pg_proc WHERE oid='public.approva_variante(uuid,text)'::regprocedure"))[0].prosrc,before)
 }finally{await db.close()}
})
