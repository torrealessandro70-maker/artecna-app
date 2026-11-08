/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{performance}=require('node:perf_hooks'),crypto=require('node:crypto');
const {withNative}=require('./native.cjs'),{certifiedInstallerFixture}=require('./installerBaseline.cjs'),{seedRuntime}=require('./runtimeFixture.cjs');
const root=path.resolve(__dirname,'../../..'),load=n=>fs.readFileSync(path.join(root,'supabase/migrations',n),'utf8').replace(/\r\n/g,'\n'),base=load('20261108000800_cantiere_hard_delete_finale.sql'),runtime=load('20261108000900_cantiere_hard_delete_runtime_v2.sql');
const results=[];
test('hard-delete regression contract V1; native PostgreSQL 17.6',{timeout:900000},t=>withNative(async(db,connect)=>{
 const q=async(s,p)=>(await db.query(s,p)).rows,admin=await connect('fixture_admin');await q(base);
 const oldPreserved=(await q("SELECT pg_get_functiondef('artecna_distruzione.hard_delete_preserved(uuid,jsonb)'::regprocedure) def"))[0].def;
 const oldLock=(await q("SELECT pg_get_functiondef('artecna_distruzione.hard_delete_lock(uuid)'::regprocedure) def"))[0].def;
 await q(runtime);assert.equal((await q("SELECT pg_get_functiondef('artecna_distruzione.hard_delete_lock(uuid)'::regprocedure) def"))[0].def,oldLock);
 await admin.query('ALTER ROLE postgres SUPERUSER');
 await t.test('preserved accepts only frozen positive PK witnesses; no unbounded exclusion scan',async()=>{
  assert.equal(crypto.createHash('sha256').update(base).digest('hex'),'31badc610d022416c0a6066197bbd544c44f97424e7e3b927a5ff2058a4a3c80','Applied migration 008 must remain immutable');
  const source=(await q("SELECT prosrc FROM pg_proc WHERE oid='artecna_distruzione.hard_delete_preserved(uuid,jsonb)'::regprocedure"))[0].prosrc;
  assert(!/WHERE\s+true/i.test(source));assert(!/FROM\s+\S+\s+t\s+WHERE\s+NOT\s+EXISTS/i.test(source));
  assert(source.includes('jsonb_to_recordset'));assert(source.includes('JOIN public.foto_sopralluogo t ON t."id"=k."id"'));
  for(const line of source.split('\n').filter(s=>s.includes('result:=result||')))assert(line.startsWith('IF jsonb_array_length(')&&line.includes('JOIN '));
  const rpc=(await q("SELECT prosrc FROM pg_proc WHERE oid='public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure"))[0].prosrc;assert.equal((rpc.match(/hard_delete_targets\(cid\)/g)||[]).length,1);
 });
 for(const scale of [0,1,10]){let caseError;await t.test('Production-equivalent target, global scale '+scale,async()=>{
  await q('BEGIN');try{
   const fixture=await seedRuntime(db,scale),a=fixture.a;
   if(scale){const volumes=require('./runtimeProductionVolume.json').rows,staticTables=new Set(['artecna_distruzione.cleanup_storage','artecna_distruzione.hard_delete_catalog_expected','artecna_distruzione.legacy_sorgenti','artecna_distruzione.storage_copertura','artecna_distruzione.storage_sorgenti']);for(const [table,count] of Object.entries(volumes)){if(count&&!staticTables.has(table)){const actual=Number((await q('SELECT count(*) n FROM '+table))[0].n);assert(actual>=count*scale,table+' fixture smaller than Production: '+actual+' < '+count*scale);}}}
   const timed=async(name,s,p)=>{const start=performance.now(),rows=await q(s,p);const ms=performance.now()-start;return {phase:name,ms,rows};};
   await q('SAVEPOINT cold');await q("SET LOCAL statement_timeout='8s'");await q('SET ROLE authenticated');const cold=await timed('delete_complete_cold','SELECT * FROM public.elimina_cantiere_definitivamente($1,$2)',[a,'ELIMINA']);await q('RESET ROLE');await q('ROLLBACK TO cold');assert(cold.ms<(scale===10?6000:4000),'Cold hard-delete budget exceeded: '+cold.ms);
   const phases=[];phases.push(await timed('catalog','SELECT artecna_distruzione.hard_delete_catalog() r'));
   const targets=await timed('targets','SELECT artecna_distruzione.hard_delete_targets($1) r',[a]);phases.push(targets);const plan=targets.rows[0].r;
   for(const [tab,count] of Object.entries({'public.cantieri':1,'public.rapportini':4,'public.timbrature':3,'public.foto_cantiere':2,'public.rapportino_prestazioni':3,'artecna_rapportini.richieste':3,'artecna_rapportini.allegati':1,'public.economia_raccolte':3,'public.economia_sorgenti':1,'public.economia_righe':53,'public.varianti_cantiere':4,'public.variante_sorgenti':1,'public.preventivi_cantiere':1,'public.preventivo_lavorazioni':19}))assert.equal(plan[tab].length,count,tab);
   assert.equal(Number((await q('SELECT count(*) n FROM artecna_distruzione.storage_riferimenti WHERE cantiere_id=$1',[a]))[0].n),3);
   const measured=require('./runtimeProductionVolume.json').target_witness_sizes;assert.equal(Number((await q('SELECT sum(octet_length(immagine_base64)) n FROM public.foto_cantiere WHERE cantiere_id=$1',[a]))[0].n),measured.target_foto.base64_bytes);const sharedSize=(await q('SELECT octet_length(testo) text_bytes,octet_length(checklist::text)+octet_length(disegni::text)+coalesce(octet_length(analisi_ai::text),0) json_bytes FROM public.quaderno_progetti WHERE id=$1',[fixture.quaderno]))[0];assert.equal(sharedSize.text_bytes,measured.shared_quaderno.text_bytes);assert.equal(sharedSize.json_bytes,measured.shared_quaderno.json_bytes);assert.equal(plan['public.variante_fonti_visive'].length,1);assert.equal(plan['public.variante_fonti_visive'][0].source_type,'foto_cantiere');assert.equal(plan['public.variante_fonti_memory'].length,1);
   const blockers=await timed('blockers','SELECT artecna_distruzione.hard_delete_blockers($1,$2::jsonb) r',[a,JSON.stringify(plan)]);assert.deepEqual(blockers.rows[0].r,[]);phases.push(blockers);
   const preserved=await timed('preserved_before','SELECT artecna_distruzione.hard_delete_preserved($1,$2::jsonb) r',[a,JSON.stringify(plan)]);phases.push(preserved);
   assert(!Object.hasOwn(preserved.rows[0].r,'public.prezzi_lavorazioni'));assert(!Object.hasOwn(preserved.rows[0].r,'public.foto_sopralluogo'));assert(Object.hasOwn(preserved.rows[0].r,'public.quaderno_progetti'));
   const perTable=[];
   if(scale===1){
    const start=performance.now();await q(oldPreserved.replaceAll('hard_delete_preserved(','hard_delete_original_preserved('));await q('UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()');const old=await timed('old_preserved_1x','SELECT artecna_distruzione.hard_delete_original_preserved($1,$2::jsonb) r',[a,JSON.stringify(plan)]);results.push({scale,old_preserved_ms:old.ms,setup_ms:performance.now()-start});
    for(const line of oldPreserved.split('\n')){const m=line.match(/result:=result\|\|jsonb_build_object\('([^']+)',([\s\S]*)\);/);if(m){const r=await timed(m[1],'WITH args AS(SELECT $1::uuid cid,$2::jsonb targets) SELECT '+m[2]+' r FROM args',[a,JSON.stringify(plan)]);perTable.push({table:m[1],ms:r.ms});}}
   }
   const notices=[];const collect=n=>{if(n.message.startsWith('RUNTIME_PHASE '))notices.push(JSON.parse(n.message.slice(14)));};db.on('notice',collect);
   // Instrument only a savepoint-local copy, then restore and measure the actual
   // uninstrumented function separately against the same fixture.
   await q('SAVEPOINT profile');const rpcDef=(await q("SELECT pg_get_functiondef('public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure) def"))[0].def;
   let instrumented=rpcDef.replace('\nBEGIN\n','\n_runtime_mark timestamptz:=clock_timestamp();\nBEGIN\n');
   const mark=name=>` RAISE NOTICE 'RUNTIME_PHASE %',jsonb_build_object('phase','${name}','ms',extract(epoch FROM(clock_timestamp()-_runtime_mark))*1000);_runtime_mark:=clock_timestamp();`;
   for(const [token,name] of [['PERFORM artecna_distruzione.apri_contesto_prerequisiti(cid,p_conferma);','jwt_owner'],['PERFORM artecna_distruzione.hard_delete_lock(cid);','lock'],['targets:=artecna_distruzione.hard_delete_targets(cid);','targets'],['blockers:=artecna_distruzione.hard_delete_blockers(cid,targets);','blockers'],['preserved:=artecna_distruzione.hard_delete_preserved(cid,targets);','preserved_before'],['PERFORM artecna_distruzione.detach_contabile_cantiere();','storage_and_detach']]){assert(instrumented.includes(token),token);instrumented=instrumented.replace(token,token+'\n'+mark(name));}
   instrumented=instrumented.replace(/(conteggi:=conteggi\|\|jsonb_build_object\('([^']+)',total\);)/g,(_,full,tab)=>full+'\n'+mark('delete:'+tab));
   instrumented=instrumented.replace(' after_keep:=artecna_distruzione.hard_delete_preserved(cid,targets);',mark('verification_final')+'\n after_keep:=artecna_distruzione.hard_delete_preserved(cid,targets);\n'+mark('preserved_after'));
   await q(instrumented);await q('UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()');
   await q("SET LOCAL statement_timeout='8s'");await q('SET ROLE authenticated');await q('SELECT * FROM public.elimina_cantiere_definitivamente($1,$2)',[a,'ELIMINA']);await q('RESET ROLE');await q('ROLLBACK TO profile');db.removeListener('notice',collect);
   await q("SET LOCAL statement_timeout='8s'");await q('SET ROLE authenticated');const complete=await timed('delete_complete','SELECT * FROM public.elimina_cantiere_definitivamente($1,$2)',[a,'ELIMINA']);await q('RESET ROLE');assert.equal(complete.rows[0].eliminato,true);
   const after=await timed('preserved_after','SELECT artecna_distruzione.hard_delete_preserved($1,$2::jsonb) r',[a,JSON.stringify(plan)]);assert.deepEqual(after.rows[0].r,preserved.rows[0].r);phases.push(after);
   assert.equal((await q('SELECT count(*)::int n FROM public.cantieri WHERE id=$1',[a]))[0].n,0);
   assert(complete.ms<(scale===10?6000:4000),'Full hard-delete budget exceeded: '+complete.ms);
   const row={scale,phases:phases.map(p=>({phase:p.phase,ms:p.ms})),total_ms:Math.max(cold.ms,complete.ms),cold_ms:cold.ms,warm_ms:complete.ms,profile:notices,old_per_table:perTable};results.push(row);fs.writeFileSync(path.join(root,'.run/runtime-benchmark.json'),JSON.stringify(results,null,2)+'\n');
  }catch(e){caseError=e;console.error('Runtime scale '+scale+':',e.message,e.stack);throw e;}finally{await q('RESET ROLE').catch(()=>{});await q('ROLLBACK');}
 });if(caseError)throw caseError;}
 const one=results.find(r=>r.scale===1&&r.phases),ten=results.find(r=>r.scale===10&&r.phases);assert(one&&ten,'Both mandatory benchmark datasets must execute');assert(ten.phases.find(p=>p.phase==='preserved_before').ms<Math.max(150,one.phases.find(p=>p.phase==='preserved_before').ms*3),'Preserved scales with unrelated data');
 await t.test('a changed directly linked shared witness rolls back the complete delete',async()=>{
  await q('BEGIN');try{const f=await seedRuntime(db,0);await q(`CREATE FUNCTION public.runtime_corrupt_shared() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$ BEGIN UPDATE public.quaderno_progetti SET testo='tampered' WHERE id=TG_ARGV[0]::uuid;RETURN OLD;END $$;CREATE TRIGGER runtime_corrupt_shared AFTER DELETE ON public.foto_cantiere FOR EACH ROW EXECUTE FUNCTION public.runtime_corrupt_shared('${f.quaderno}');UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()`);
   await q('SAVEPOINT injected');await q('SET ROLE authenticated');await assert.rejects(q('SELECT * FROM public.elimina_cantiere_definitivamente($1,$2)',[f.a,'ELIMINA']),/Dati estranei\/shared modificati/);await q('ROLLBACK TO injected');await q('RESET ROLE');assert.equal((await q('SELECT testo FROM public.quaderno_progetti WHERE id=$1',[f.quaderno]))[0].testo,'Q'.repeat(84));assert.equal(Number((await q('SELECT count(*) n FROM public.cantieri WHERE id=$1',[f.a]))[0].n),1);assert.equal(Number((await q('SELECT count(*) n FROM artecna_distruzione.cleanup_storage'))[0].n),7);
  }finally{await q('ROLLBACK');}
 });
 await t.test('corrupt new legal archive values fail the normalized before/after witnesses',async()=>{
  await q('BEGIN');try{const f=await seedRuntime(db,0);const invoice=(await q("INSERT INTO public.fatture_fornitori(tipo_documento) VALUES('TD01') RETURNING id"))[0].id,line=(await q('INSERT INTO public.fatture_fornitori_righe(fattura_id,cantiere_id,quantita,prezzo_unitario) VALUES($1,$2,100,10) RETURNING id',[invoice,f.a]))[0].id;
   await q('SET ROLE artecna_materiali_fattura_rpc');await q("INSERT INTO public.materiali_cantiere(cantiere,cantiere_id,fattura_riga_id,descrizione,quantita,prezzo_unitario,totale,unita_misura) VALUES('Runtime target',$1,$2,'Legal fixture',2,10,20,'pz')",[f.a,line]);await q('RESET ROLE');
   await q("CREATE FUNCTION public.runtime_corrupt_archive() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.quantita:=NEW.quantita*2;RETURN NEW;END $$;CREATE TRIGGER runtime_corrupt_archive BEFORE INSERT ON artecna_contabilita.archivio_quote FOR EACH ROW EXECUTE FUNCTION public.runtime_corrupt_archive();UPDATE artecna_distruzione.hard_delete_catalog_expected SET signature=artecna_distruzione.hard_delete_catalog()");await q('SAVEPOINT injected');await q('SET ROLE authenticated');await assert.rejects(q('SELECT * FROM public.elimina_cantiere_definitivamente($1,$2)',[f.a,'ELIMINA']),/Dati estranei\/shared modificati/);await q('ROLLBACK TO injected');await q('RESET ROLE');assert.equal(Number((await q('SELECT count(*) n FROM artecna_contabilita.archivio_quote'))[0].n),0);
  }finally{await q('RESET ROLE').catch(()=>{});await q('ROLLBACK');}
 });
 await t.test('JSON logical edges are indexed and only the authorized identifiers are sanitized',async()=>{
  await q('BEGIN');try{const f=await seedRuntime(db,0),invoice=(await q("INSERT INTO public.fatture_fornitori(tipo_documento) VALUES('TD01') RETURNING id"))[0].id;
   await q("INSERT INTO artecna_guardie.fatture_classificazione_richieste(user_id,richiesta_id,fattura_id,payload,risultato) VALUES($1,gen_random_uuid(),$2,jsonb_build_object('cid',$3::text,'amount',17),jsonb_build_object('cid',gen_random_uuid()::text))",[f.u,invoice,f.a]);assert.equal(Number((await q('SELECT count(*) n FROM artecna_distruzione.runtime_ownership_edges WHERE referenced_uuid=$1',[f.a]))[0].n),1);
   const expected=(await q('SELECT artecna_distruzione.sanifica_archivio(payload,artecna_distruzione.ids_operativi($1)) j FROM artecna_guardie.fatture_classificazione_richieste',[f.a]))[0].j;
   await q('SET ROLE authenticated');assert.equal((await q('SELECT * FROM public.elimina_cantiere_definitivamente($1,$2)',[f.a,'ELIMINA']))[0].eliminato,true);await q('RESET ROLE');assert.deepEqual((await q('SELECT payload FROM artecna_guardie.fatture_classificazione_richieste'))[0].payload,expected);assert.equal(Number((await q('SELECT count(*) n FROM artecna_distruzione.runtime_ownership_edges WHERE referenced_uuid=$1',[f.a]))[0].n),0);
  }finally{await q('RESET ROLE').catch(()=>{});await q('ROLLBACK');}
 });
 await t.test('new FK, logical edge and Cantiere table fail closed before delete',async()=>{
  for(const ddl of ['CREATE TABLE public.runtime_new_owner(id uuid PRIMARY KEY,cantiere_id uuid REFERENCES public.cantieri(id))','CREATE TABLE public.hard_delete_unclassified(id uuid PRIMARY KEY,cantiere_id uuid)','ALTER TABLE public.prezzi_lavorazioni ADD COLUMN cantiere_id uuid','ALTER TABLE public.variante_fonti_memory DROP CONSTRAINT variante_fonti_memory_source_type_check','ALTER FUNCTION artecna_distruzione.hard_delete_shared_scope(uuid,jsonb) SECURITY INVOKER']){
   await q('BEGIN');try{const {a}=await seedRuntime(db,0);await q(ddl);assert.deepEqual((await q('SELECT artecna_distruzione.hard_delete_blockers($1) r',[a]))[0].r,['catalogo']);await q('SET ROLE authenticated');await assert.rejects(q('SELECT * FROM public.elimina_cantiere_definitivamente($1,$2)',[a,'ELIMINA']),/Hard delete bloccato/);await q('RESET ROLE').catch(()=>{});await q('ROLLBACK');}finally{await q('ROLLBACK');}
  }
 });
},{productionActor:true,beforeMigrations:certifiedInstallerFixture}));
