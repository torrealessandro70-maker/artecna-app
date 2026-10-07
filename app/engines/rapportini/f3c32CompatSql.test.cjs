// PostgreSQL 17 reale, solo localhost. Riusa il laboratorio F3C3 e le RPC storiche.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {randomUUID}=require('node:crypto')
const {A,B,RAP,USER,TOKEN}=require('./fixtureStep3.cjs')
const migrations=path.resolve(__dirname,'../../../supabase/migrations')
const read=n=>fs.readFileSync(path.join(migrations,n),'utf8').replace(/\r\n/g,'\n')
const sql=read('20261007_f3c32_compatibilita_legacy_foto.sql')
const economia=read('20261002_economia_v1_integrazione_eliminazione.sql')
const baseline=JSON.parse(economia.split('$baseline$')[1])
const body=tag=>economia.split('$'+tag+'$')[1]
const ident=s=>'"'+s.replaceAll('"','""')+'"'
const query=async(c,s,a=[])=>(await c.query(s,a)).rows
const rename='SELECT public.rinomina_cantiere_legacy_senza_allegati($1,$2,$3,$4,$5)'
const remove='SELECT public.elimina_rapportino_legacy_senza_allegati($1)'
const destroy="SELECT * FROM public.elimina_cantiere_definitivamente($1,'ELIMINA')"
async function setup(h){
 await h.install()
 await h.admin.query(`ALTER TABLE public.cantieri ADD preventivo double precision,ADD data_inizio_lavori date,ADD data_fine_lavori date,ADD preventivo_contrattuale_id text;
 ALTER TABLE public.economia_raccolte ADD cantiere_id uuid;
 ALTER TABLE public.economia_righe ADD raccolta_id uuid,ADD sorgente_id uuid;
 CREATE TABLE public.economia_sorgenti(id uuid PRIMARY KEY,raccolta_id uuid,UNIQUE(id,raccolta_id));
 ALTER TABLE public.economia_raccolte ADD CONSTRAINT economia_raccolte_cantiere_fk FOREIGN KEY(cantiere_id) REFERENCES public.cantieri(id) ON DELETE RESTRICT;
 ALTER TABLE public.economia_sorgenti ADD CONSTRAINT economia_sorgenti_raccolta_fk FOREIGN KEY(raccolta_id) REFERENCES public.economia_raccolte(id) ON DELETE RESTRICT;
 ALTER TABLE public.economia_righe ADD CONSTRAINT economia_righe_raccolta_fk FOREIGN KEY(raccolta_id) REFERENCES public.economia_raccolte(id) ON DELETE RESTRICT;
 ALTER TABLE public.economia_righe ADD CONSTRAINT economia_righe_sorgente_fk FOREIGN KEY(sorgente_id,raccolta_id) REFERENCES public.economia_sorgenti(id,raccolta_id) ON DELETE RESTRICT;
 CREATE TABLE public.preventivi_cantiere(id text PRIMARY KEY,cantiere_id uuid,cantiere text,file_path text);
 CREATE TABLE public.preventivo_lavorazioni(id bigint PRIMARY KEY,cantiere_id uuid);
 CREATE TABLE public.variante_lavorazioni(id bigint PRIMARY KEY,variante_id uuid,riferimento_variante_lavorazione_id bigint);
 CREATE TABLE public.variante_documenti(id uuid PRIMARY KEY,variante_id uuid,storage_path text);
 CREATE TABLE public.variante_sorgenti(id uuid PRIMARY KEY,variante_id uuid);
 CREATE TABLE public.sal_lavorazioni(id bigint PRIMARY KEY,cantiere_id uuid,source_lavorazione_id bigint,source_variante_lavorazione_id bigint);
 CREATE SCHEMA artecna_distruzione;`)
 for(const name of ['materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati'])
  await h.admin.query(`CREATE TABLE public.${ident(name)}(id uuid PRIMARY KEY,cantiere_id uuid,cantiere text,file_path text)`)
 // Tabelle e contesto provengono dall'audit incorporato nella migration Economia.
 for(const table of baseline.distruzione.tabelle){
  await h.admin.query(`CREATE TABLE artecna_distruzione.${ident(table.nome)}(${table.colonne.map(c=>ident(c.nome)+' '+c.tipo+(c.identity?' GENERATED ALWAYS AS IDENTITY':c.default?' DEFAULT '+c.default:'')+(c.not_null?' NOT NULL':'')).join(',')})`)
  for(const k of table.constraints)await h.admin.query(`ALTER TABLE artecna_distruzione.${ident(table.nome)} ADD CONSTRAINT ${ident(k.nome)} ${k.definition}`)
 }
 for(const f of baseline.autorizzazione.funzioni.filter(f=>f.firma.startsWith('artecna_distruzione.')))await h.admin.query(f.definition)
 await h.admin.query(`CREATE FUNCTION artecna_distruzione.manifest_cantiere(p_cantiere uuid) RETURNS TABLE(entita text,quantita bigint) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $f$${body('newmanifest')}$f$`)
 const old=read('20261001_elimina_cantiere_definitivamente.sql')
 const imprint=old.split('$ddl$CREATE FUNCTION artecna_distruzione.impronta_cleanup_storage')[1].split('$ddl$')[0]
 await h.admin.query('CREATE FUNCTION artecna_distruzione.impronta_cleanup_storage'+imprint)
 // L'helper outbox legacy è eseguito realmente; nessun inventario Storage V1.
 await h.admin.query(`CREATE FUNCTION artecna_distruzione.prepara_cleanup_storage(p_cantiere uuid) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $outboxhelper1$${old.split('$outboxhelper1$')[1]}$outboxhelper1$`)
 await h.admin.query(`CREATE FUNCTION public.elimina_cantiere_definitivamente(p_cantiere_id uuid,p_conferma text) RETURNS TABLE(cantiere_id uuid,eliminato boolean,storage_nuovi bigint,conteggi jsonb) LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO pg_catalog,pg_temp AS $f$${body('newdelete')}$f$;
 ALTER FUNCTION public.elimina_cantiere_definitivamente(uuid,text) OWNER TO artecna_cantieri_delete_rpc;
 REVOKE ALL ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) FROM PUBLIC,anon,service_role;
 GRANT EXECUTE ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) TO authenticated;
 ALTER ROLE artecna_cantieri_delete_rpc BYPASSRLS;
 GRANT USAGE ON SCHEMA public,artecna_guardie,artecna_distruzione TO artecna_cantieri_delete_rpc;
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA artecna_guardie,artecna_distruzione TO artecna_cantieri_delete_rpc;
 GRANT SELECT,DELETE,UPDATE ON ALL TABLES IN SCHEMA public TO artecna_cantieri_delete_rpc;
 REVOKE CREATE ON SCHEMA public FROM PUBLIC,artecna_cantieri_delete_rpc;`)
 await h.admin.query('GRANT artecna_cantieri_delete_rpc TO postgres WITH ADMIN TRUE, INHERIT FALSE, SET FALSE GRANTED BY supabase_admin')
 await h.admin.query('GRANT ALL ON ALL TABLES IN SCHEMA public,artecna_distruzione TO postgres; GRANT ALL ON ALL SEQUENCES IN SCHEMA artecna_distruzione TO postgres')
 return ()=>h.installer.query(sql)
}
async function snapshot(h){return {photos:(await h.snapshot()).photos,allegati:(await h.snapshot()).allegati,
 cantieri:await query(h.admin,'SELECT to_jsonb(c) v FROM public.cantieri c ORDER BY id'),
 rapportini:await query(h.admin,'SELECT to_jsonb(r) v FROM public.rapportini r ORDER BY id'),
 outbox:await query(h.admin,'SELECT to_jsonb(j) v FROM artecna_distruzione.cleanup_storage j ORDER BY id'),
 context:await query(h.admin,'SELECT to_jsonb(c) v FROM artecna_distruzione.contesto c')}}
async function auth(h,action){return h.as('authenticated',async c=>{await c.query("SELECT set_config('test.user',$1,false)",[USER]);return action(c)})}
async function legacyPhoto(h){const id=randomUUID();await h.admin.query("INSERT INTO public.foto_cantiere(id,cantiere_id,cantiere,rapportino_id,nota,file_path) VALUES($1,$2,'Cantiere A',$3,'V0','legacy.jpg')",[id,A,RAP]);return id}
async function makeV0(h){await h.as('artecna_rapportini_rpc',c=>c.query('UPDATE public.rapportini SET versione_prestazioni=0 WHERE id=$1',[RAP]))}
async function state(h,s){const r=await h.reserve();if(s==='finalizzato'||s==='cancellazione_pending'){await h.finalize(r);if(s==='cancellazione_pending')await h.cancel(r)}
 else if(s==='cancellato')await h.cancel(r);else if(s==='scaduto')await h.admin.query("UPDATE artecna_rapportini.allegati SET stato='scaduto',lease_id=NULL,lease_until=NULL WHERE id=$1",[r.allegato_id]);return r}
async function removeUnrelatedFixtureFKs(h){
 // SOLO questa fixture ridotta: non è una certificazione dell'intero schema Production.
 const ks=await query(h.admin,`SELECT k.oid,k.conrelid::regclass::text rel,k.conname FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE k.contype='f' AND ((n.nspname='artecna_rapportini' AND c.relname<>'allegati') OR c.relname='rapportino_prestazioni') AND k.confrelid IN ('public.cantieri'::regclass,'public.rapportini'::regclass,'public.varianti_cantiere'::regclass,'public.economia_raccolte'::regclass,'public.economia_righe'::regclass)`)
 for(const k of ks)await h.admin.query(`ALTER TABLE ${k.rel} DROP CONSTRAINT ${ident(k.conname)}`)
}
async function compatTests(t,lab,connect){
 await t.test('installazione: ACL/default grants neutralizzati, guardie e ACL legacy invariate',()=>lab(async h=>{
  const install=await setup(h),before=await h.snapshot();await install();const after=await h.snapshot()
  assert.deepEqual(after.acl,before.acl);assert.deepEqual(after.triggers,before.triggers);assert.deepEqual(after.photos,before.photos)
  for(const role of ['anon','service_role','artecna_rapportini_backend'])assert.equal((await query(h.admin,"SELECT has_function_privilege($1,'public.rinomina_cantiere_legacy_senza_allegati(uuid,text,text,text,jsonb)','EXECUTE') v",[role]))[0].v,false)
  assert.equal((await h.q("SELECT has_table_privilege('authenticated','artecna_rapportini.allegati','SELECT,INSERT,UPDATE,DELETE') v"))[0].v,false)
 }))
 for(const mode of ['legacy','scheda','registro'])await t.test('rinomina V0 '+mode+': UUID, comportamento legacy e commit atomico',()=>lab(async h=>{
  const install=await setup(h);await install();const photo=await legacyPhoto(h)
  await auth(h,c=>c.query(rename,[A,'Cantiere A','Nuovo',mode,mode==='registro'?{preventivo:42,data_inizio_lavori:'2026-10-01',data_fine_lavori:null,lavori_conclusi:false}:{}]))
  assert.equal((await h.q(`SELECT nome FROM public.cantieri WHERE id='${A}'`))[0].nome,'Nuovo')
  assert.equal((await h.q(`SELECT cantiere FROM public.foto_cantiere WHERE id='${photo}'`))[0].cantiere,mode==='legacy'?'Nuovo':'Cantiere A')
 }))
 for(const s of ['prenotato','finalizzato','cancellazione_pending','cancellato','scaduto'])await t.test(s+': tre rinomine, Rapportino e distruzione bloccati prima delle mutazioni',()=>lab(async h=>{
  const install=await setup(h);await install();await legacyPhoto(h);await state(h,s);const before=await snapshot(h)
  for(const mode of ['legacy','scheda','registro'])await auth(h,c=>assert.rejects(()=>c.query(rename,[A,'Cantiere A','Nuovo',mode,mode==='registro'?{preventivo:42,data_inizio_lavori:null,data_fine_lavori:null,lavori_conclusi:false}:{}]),e=>e.code==='P2131'))
  await auth(h,c=>assert.rejects(()=>c.query(remove,[RAP]),e=>e.code==='P2132'))
  await auth(h,c=>assert.rejects(()=>c.query(destroy,[A]),e=>e.code==='P2131'))
  assert.deepEqual(await snapshot(h),before)
 }))
 await t.test('Rapportino solo V0: scollegamento e DELETE nella stessa transazione',()=>lab(async h=>{
  const install=await setup(h);await install();const photo=await legacyPhoto(h);await makeV0(h);await auth(h,c=>c.query(remove,[RAP]));assert.equal((await h.q(`SELECT rapportino_id FROM public.foto_cantiere WHERE id='${photo}'`))[0].rapportino_id,null)
  assert.equal((await h.q(`SELECT count(*)::integer n FROM public.rapportini WHERE id='${RAP}'`))[0].n,0)
 }))
 await t.test('rinomina: finalizzazione concorrente attende il lock e nessuna scrittura parziale',()=>lab(async h=>{
  const install=await setup(h);await install();const r=await h.reserve();const other=await connect('supabase_admin',h.backend.database)
  try{await h.backend.query('BEGIN');await h.finalize(r);await other.query('SET SESSION AUTHORIZATION authenticated');await other.query("SELECT set_config('test.user',$1,false)",[USER]);let finished=false
   const pending=other.query(rename,[A,'Cantiere A','Nuovo','legacy',{}]).then(()=>{finished=true;return null},e=>{finished=true;return e})
   await new Promise(r=>setTimeout(r,100));assert.equal(finished,false);await h.backend.query('COMMIT');const error=await pending;assert.equal(error.code,'P2131');assert.equal((await h.q(`SELECT nome FROM public.cantieri WHERE id='${A}'`))[0].nome,'Cantiere A')
  }finally{await h.backend.query('ROLLBACK');await other.end()}
 }))
 await t.test('distruzione: FK private prestazioni restano un gate reale, outbox invariata',()=>lab(async h=>{
  const install=await setup(h);await install();const before=await snapshot(h);await auth(h,c=>assert.rejects(()=>c.query(destroy,[A]),e=>e.code==='P2113'));assert.deepEqual(await snapshot(h),before)
 }))
 for(const elsewhere of [false,true])await t.test('fixture circoscritta: distruzione V0'+(elsewhere?' con Allegati soltanto altrove':''),()=>lab(async h=>{
  const install=await setup(h);await install();await removeUnrelatedFixtureFKs(h);if(!elsewhere)await makeV0(h);await legacyPhoto(h)
  if(elsewhere){await state(h,'prenotato'); // Il target è B; A e il suo Allegato devono restare.
   await h.admin.query("INSERT INTO public.utenti_cantiere VALUES($1,$2,'owner')",[B,USER]);await auth(h,c=>c.query(destroy,[B]));assert.equal((await h.q(`SELECT count(*)::integer n FROM artecna_rapportini.allegati WHERE cantiere_id='${A}'`))[0].n,1)
  }else {const result=await auth(h,c=>query(c,destroy,[A]));assert.equal(result[0].eliminato,true);assert.equal((await h.q(`SELECT count(*)::integer n FROM public.cantieri WHERE id='${A}'`))[0].n,0)}
 }))
 await t.test('FK sconosciuta reale resta rifiutata anche vuota: rollback/outbox',()=>lab(async h=>{
  const install=await setup(h);await install();await removeUnrelatedFixtureFKs(h);await h.admin.query('CREATE TABLE public.dipendenza_non_certificata(id uuid,cantiere_id uuid REFERENCES public.cantieri(id))');const before=await snapshot(h);await auth(h,c=>assert.rejects(()=>c.query(destroy,[A]),e=>e.code==='P2113'));assert.deepEqual(await snapshot(h),before)
 }))
 for(const [label,mutation] of [['fingerprint','ALTER FUNCTION public.elimina_cantiere_definitivamente(uuid,text) SECURITY INVOKER'],['ACL','GRANT EXECUTE ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) TO anon'],['installer','GRANT CREATE ON SCHEMA public TO artecna_cantieri_delete_rpc'],['RLS registro forzata','ALTER TABLE artecna_rapportini.allegati FORCE ROW LEVEL SECURITY'],['guardia disattivata','ALTER TABLE public.foto_cantiere DISABLE TRIGGER f3c3_foto_dml']])await t.test('preflight '+label+': rollback migration completo',()=>lab(async h=>{
  const install=await setup(h);await h.admin.query(mutation);const before=await h.snapshot();await assert.rejects(install);await h.installer.query('ROLLBACK');assert.deepEqual(await h.snapshot(),before)
 }))
 await t.test('post-check fallito: RPC originale e privilegi ripristinati',()=>lab(async h=>{
  await setup(h);const before=await h.snapshot();await assert.rejects(()=>h.installer.query(sql.replace('-- F3C32_POSTCHECK',"DO $$BEGIN RAISE EXCEPTION 'test rollback';END$$;\n-- F3C32_POSTCHECK")));await h.installer.query('ROLLBACK');assert.deepEqual(await h.snapshot(),before)
 }))
 await t.test('default privileges ostili: soltanto capability previste, schema privato senza SELECT browser',()=>lab(async h=>{
  const install=await setup(h);await h.installer.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO artecna_cantieri_delete_rpc; ALTER DEFAULT PRIVILEGES IN SCHEMA artecna_rapportini GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role,artecna_rapportini_backend');await install()
  assert.equal((await h.q("SELECT has_function_privilege('artecna_cantieri_delete_rpc','public.elimina_rapportino_legacy_senza_allegati(uuid)','EXECUTE') v"))[0].v,false)
  for(const role of ['anon','authenticated','service_role','artecna_rapportini_backend'])assert.equal((await query(h.admin,"SELECT has_function_privilege($1,'artecna_rapportini.compat_foto_verifica_cantiere(uuid)','EXECUTE') v",[role]))[0].v,false)
 }))
 await t.test('FK Allegati divergente: preflight abortisce e ripristina ogni nuova funzione',()=>lab(async h=>{
  const install=await setup(h);await h.admin.query('ALTER TABLE artecna_rapportini.allegati RENAME CONSTRAINT allegati_cantiere_id_fkey TO inattesa');const before=await h.snapshot();await assert.rejects(install,e=>e.code==='P2113');await h.installer.query('ROLLBACK');assert.deepEqual(await h.snapshot(),before)
 }))
 await t.test('Rapportino: errore DELETE dopo unlink provoca rollback dello scollegamento V0',()=>lab(async h=>{
  const install=await setup(h);await install();await makeV0(h);await legacyPhoto(h);await h.admin.query(`CREATE FUNCTION public.test_delete_abort() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'delete abort';END$$;CREATE TRIGGER test_delete_abort BEFORE DELETE ON public.rapportini FOR EACH ROW EXECUTE FUNCTION public.test_delete_abort()`);const before=await snapshot(h);await auth(h,c=>assert.rejects(()=>c.query(remove,[RAP]),/delete abort/));assert.deepEqual(await snapshot(h),before)
 }))
 await t.test('rinomina: errore su ultimo writer legacy ripristina cantiere e foto V0',()=>lab(async h=>{
  const install=await setup(h);await install();await legacyPhoto(h);await h.admin.query(`INSERT INTO public.attrezzi_cantiere(id,cantiere_id,cantiere) VALUES(gen_random_uuid(),'${A}','Cantiere A');CREATE FUNCTION public.test_update_abort() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'update abort';END$$;CREATE TRIGGER test_update_abort BEFORE UPDATE ON public.attrezzi_cantiere FOR EACH ROW EXECUTE FUNCTION public.test_update_abort()`);const before=await snapshot(h);await auth(h,c=>assert.rejects(()=>c.query(rename,[A,'Cantiere A','Nuovo','legacy',{}]),/update abort/));assert.deepEqual(await snapshot(h),before)
 }))
 await t.test('owner mancante: RPC additive rifiutano senza mutazioni',()=>lab(async h=>{
  const install=await setup(h);await install();const before=await snapshot(h);await h.as('authenticated',async c=>{await c.query("SELECT set_config('test.user',$1,false)",[randomUUID()]);await assert.rejects(()=>c.query(remove,[RAP]),e=>e.code==='42501');await assert.rejects(()=>c.query(rename,[A,'Cantiere A','Nuovo','scheda',{}]),e=>e.code==='42501')});assert.deepEqual(await snapshot(h),before)
 }))
 await t.test('rinomina prima della prenotazione: lock serializza nuovi Allegati, proiezione usa il nome aggiornato',()=>lab(async h=>{
  const install=await setup(h);await install();let pending
  await auth(h,async c=>{await c.query('BEGIN');try{await c.query(rename,[A,'Cantiere A','Nuovo','legacy',{}]);let finished=false;pending=h.reserve().then(r=>{finished=true;return r});await new Promise(r=>setTimeout(r,100));assert.equal(finished,false);await c.query('COMMIT')}catch(e){await c.query('ROLLBACK');throw e}})
  const r=await pending,f=await h.finalize(r);assert.equal((await h.q(`SELECT cantiere FROM public.foto_cantiere WHERE id='${f.foto_cantiere_id}'`))[0].cantiere,'Nuovo')
 }))
 await t.test('distruzione: errore tardivo dopo outbox e DELETE figli ripristina dati e outbox',()=>lab(async h=>{
  const install=await setup(h);await install();await removeUnrelatedFixtureFKs(h);await makeV0(h);await legacyPhoto(h);await h.admin.query(`CREATE FUNCTION public.test_cantiere_abort() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RAISE EXCEPTION 'cantiere abort';END$$;CREATE TRIGGER test_cantiere_abort BEFORE DELETE ON public.cantieri FOR EACH ROW EXECUTE FUNCTION public.test_cantiere_abort()`);const before=await snapshot(h);await auth(h,c=>assert.rejects(()=>c.query(destroy,[A]),/cantiere abort/));assert.deepEqual(await snapshot(h),before)
 }))
 for(const [label,mutation] of [['ACL legacy','REVOKE SELECT ON public.foto_cantiere FROM anon;'],['guardia V1','ALTER TABLE public.foto_cantiere DISABLE TRIGGER f3c3_foto_dml;'],['helper esposto','GRANT EXECUTE ON FUNCTION artecna_rapportini.compat_foto_verifica_cantiere(uuid) TO authenticated;']])await t.test('post-check '+label+': drift tardivo provoca rollback',()=>lab(async h=>{
  await setup(h);const before=await h.snapshot();await assert.rejects(()=>h.installer.query(sql.replace('-- F3C32_POSTCHECK',mutation+'\n-- F3C32_POSTCHECK')));await h.installer.query('ROLLBACK');assert.deepEqual(await h.snapshot(),before)
 }))
}
// Riusa avvio, fixture F3C3 e teardown verificato; nessun generatore/file temporaneo.
const harness=fs.readFileSync(path.join(__dirname,'f3c3ProiezioneSql.test.cjs'),'utf8')
const start=harness.indexOf("  await t.test('zero proiezioni")
const tail=harness.lastIndexOf(' }finally{')
assert(start>0&&tail>start)
new Function('require','__dirname','compatTests',harness.slice(0,start).replace('F3C3: baseline Production, capability, guardie e compatibilità','F3C3.2: compatibilità legacy e gate atomici')+'  await compatTests(t,lab,connect)\n'+harness.slice(tail))(require,__dirname,compatTests)
